import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDbConnection } from '../database/database';
import { safeNum } from '../database/databaseHelper';

export default function ReportScreen({ navigation }) {
  const [totalSalesAmount, setTotalSalesAmount] = useState(0);
  const [packagingStocks, setPackagingStocks] = useState([]);
  const [usedMaterials, setUsedMaterials] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadReportData = async () => {
        try {
          const db = await getDbConnection();
          if (!db) return;

          // 1. Toplam Satış (TL) - İptal edilmeyen tüm siparişlerin satış tutarı
          const orderItems = await db.getAllAsync(`
            SELECT oi.order_id, oi.meal_id, oi.quantity, oi.unit_id, oi.item_sale, 
                   o.status, u.unit_symbol as order_unit_symbol,
                   r.sale_price, r.portion_quantity, ru.unit_symbol as portion_unit_symbol
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            LEFT JOIN lu_units u ON oi.unit_id = u.id
            LEFT JOIN recipes r ON oi.meal_id = r.meal_id
            LEFT JOIN lu_units ru ON r.portion_unit_id = ru.id
            WHERE o.status != 'canceled'
          `);

          let totalSales = 0;
          const getFactor = (fromSym, toSym) => {
            if (!fromSym || !toSym || fromSym === toSym) return 1;
            const f = fromSym.toLowerCase();
            const t = toSym.toLowerCase();
            if (f === 'kg' && t === 'gr') return 1 / 1000;
            if (f === 'gr' && t === 'kg') return 1000;
            if (f === 'lt' && t === 'mlt') return 1 / 1000;
            if (f === 'mlt' && t === 'lt') return 1000;
            return 1;
          };

          orderItems.forEach(item => {
            let sale = item.item_sale;
            if (sale === null || sale === undefined || sale === 0) {
              const baseSale = item.sale_price || 0;
              const basePortion = item.portion_quantity || 1;
              const factor = getFactor(item.portion_unit_symbol, item.order_unit_symbol);
              sale = (item.quantity * factor / basePortion) * baseSale;
            }
            totalSales += sale;
          });

          // 2. Ambalaj Stoğu (Toplam Alınan - Teslim Edilen Siparişlerde Kullanılan)
          const packagings = await db.getAllAsync(`
            SELECT i.id, i.ingredient_name, 
                   COALESCE((SELECT SUM(ic.quantity) FROM ingredient_costs ic WHERE ic.ingredient_id = i.id), 0) as total_purchased,
                   COALESCE((SELECT SUM(op.quantity_used) FROM order_packagings op JOIN orders ord ON op.order_id = ord.id WHERE op.ingredient_id = i.id AND ord.status = 'completed'), 0) as total_used_completed
            FROM lu_ingredients i
            WHERE i.is_packaging = 1
          `);

          const packagingStockList = packagings.map(p => ({
            name: p.ingredient_name,
            stock: p.total_purchased - p.total_used_completed,
            purchased: p.total_purchased,
            used: p.total_used_completed
          }));

          // 3. Malzeme Kullanım Listesi (Hazırlanıyor veya Teslim Edildi durumundakiler)
          const validOrderItems = await db.getAllAsync(`
            SELECT oi.meal_id, oi.quantity, oi.unit_id, u.unit_symbol as order_unit_symbol,
                   o.status
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            LEFT JOIN lu_units u ON oi.unit_id = u.id
            WHERE o.status IN ('pending', 'completed')
          `);

          const materialMap = {};

          for (const item of validOrderItems) {
            const recipeItems = await db.getAllAsync(`
              SELECT ri.ingredient_id, ri.quantity as recipe_item_qty, ri.unit_id,
                     i.ingredient_name, u.unit_symbol as recipe_unit_symbol
              FROM recipe_items ri
              JOIN lu_ingredients i ON ri.ingredient_id = i.id
              LEFT JOIN lu_units u ON ri.unit_id = u.id
              WHERE ri.recipe_id IN (SELECT id FROM recipes WHERE meal_id = ${safeNum(item.meal_id)})
            `);

            const recipeMaster = await db.getFirstAsync(`
              SELECT portion_quantity, portion_unit_id FROM recipes WHERE meal_id = ${safeNum(item.meal_id)}
            `);
            
            const portionQty = recipeMaster ? (recipeMaster.portion_quantity || 1) : 1;
            const portionUnitId = recipeMaster ? recipeMaster.portion_unit_id : null;
            let portionUnitSymbol = 'birim';
            if (portionUnitId) {
              const unitRec = await db.getFirstAsync(`SELECT unit_symbol FROM lu_units WHERE id = ${safeNum(portionUnitId)}`);
              if (unitRec) portionUnitSymbol = unitRec.unit_symbol;
            }

            const orderFactor = getFactor(portionUnitSymbol, item.order_unit_symbol);
            const orderPortionRatio = (item.quantity * orderFactor) / portionQty;

            recipeItems.forEach(ri => {
              const ingName = ri.ingredient_name;
              const unitSym = ri.recipe_unit_symbol || 'birim';
              const key = `${ingName}_${unitSym}`;
              const usedQty = ri.recipe_item_qty * orderPortionRatio;

              if (!materialMap[key]) {
                materialMap[key] = {
                  name: ingName,
                  unit: unitSym,
                  totalQty: 0
                };
              }
              materialMap[key].totalQty += usedQty;
            });
          }

          const materialList = Object.values(materialMap);

          if (active) {
            setTotalSalesAmount(totalSales);
            setPackagingStocks(packagingStockList);
            setUsedMaterials(materialList);
          }
        } catch (e) {
          console.log('Rapor ekranı yükleme hatası:', e);
        }
      };

      loadReportData();
      return () => { active = false; };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.padding}>
        <Text style={styles.headerTitle}>Durum ve İstatistik Raporu</Text>

        <TouchableOpacity 
          style={styles.topBackButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.topBackButtonText}>← Sipariş Ekranına Dön</Text>
        </TouchableOpacity>

        {/* Toplam Satış Kartı */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Geriye Dönük Toplam Satış</Text>
          <Text style={styles.cardValue}>{totalSalesAmount.toFixed(2)} TL</Text>
        </View>

        {/* Ambalaj Stok Kartları */}
        <Text style={styles.sectionTitle}>📦 Ambalaj ve Kutu Stok Durumu</Text>
        {packagingStocks.length === 0 ? (
          <Text style={styles.emptyText}>Kayıtlı ambalaj malzemesi bulunmuyor.</Text>
        ) : (
          packagingStocks.map((pkg, idx) => (
            <View key={idx} style={styles.stockCard}>
              <Text style={styles.stockName}>{pkg.name}</Text>
              <View style={styles.stockDetailsRow}>
                <Text style={styles.stockText}>Kalan Stok: <Text style={styles.bold}>{pkg.stock} adet</Text></Text>
                <Text style={styles.stockSubText}>(Alınan: {pkg.purchased} | Kullanılan: {pkg.used})</Text>
              </View>
            </View>
          ))
        )}

        {/* Malzeme Kullanım Listesi Tablosu */}
        <Text style={styles.sectionTitle}>📋 Kullanılan Malzeme Listesi (Aktif / Tamamlanan)</Text>
        {usedMaterials.length === 0 ? (
          <Text style={styles.emptyText}>Henüz siparişlerde kullanılan malzeme bulunmuyor.</Text>
        ) : (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Malzeme Adı</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Ölçü</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'right' }]}>Toplam Miktar</Text>
            </View>
            {usedMaterials.map((mat, index) => (
              <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{mat.name}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{mat.unit}</Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', fontWeight: 'bold', color: '#2B7A78' }]}>
                  {mat.totalQty % 1 === 0 ? mat.totalQty : mat.totalQty.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  padding: { padding: 20, paddingBottom: 40 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#38808A', marginBottom: 15 },
  topBackButton: { backgroundColor: '#EEE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignSelf: 'flex-start', marginBottom: 15 },
  topBackButtonText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  card: { backgroundColor: '#E8F5E9', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#C8E6C9', marginBottom: 15, alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginBottom: 5 },
  cardValue: { fontSize: 24, fontWeight: 'bold', color: '#1B5E20' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 10, color: '#333' },
  stockCard: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E9ECEF' },
  stockName: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  stockDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockText: { fontSize: 14, color: '#444' },
  stockSubText: { fontSize: 12, color: '#777' },
  bold: { color: '#38808A', fontWeight: 'bold' },
  emptyText: { fontStyle: 'italic', color: '#888', marginVertical: 8 },
  tableContainer: { borderWidth: 1, borderColor: '#CED4DA', borderRadius: 8, overflow: 'hidden', marginTop: 5 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#38808A', paddingVertical: 10, paddingHorizontal: 8 },
  tableHeaderText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E9ECEF', backgroundColor: '#FFF' },
  tableRowEven: { backgroundColor: '#F8F9FA' },
  tableCell: { fontSize: 13, color: '#333' }
});