import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getDbConnection } from '../database/database';
import { safeNum, runSafeQuery, getSafeQuery } from '../database/databaseHelper';

export default function CostScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  const route = useRoute();

  const [ingredients, setIngredients] = useState([]);
  const [units, setUnits] = useState([]);
  const [costList, setCostList] = useState([]);

  const [editingCostId, setEditingCostId] = useState(null);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [totalCost, setTotalCost] = useState('');

  const [showAddIngModal, setShowAddIngModal] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [isPackagingItem, setIsPackagingItem] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const ingResult = await getSafeQuery('SELECT * FROM lu_ingredients ORDER BY ingredient_name ASC');
          const unitResult = await getSafeQuery('SELECT * FROM lu_units');
          const costResult = await getSafeQuery(`
            SELECT ic.id, ic.ingredient_id, ic.unit_id, 
                   COALESCE(i.ingredient_name, 'Bilinmeyen Malzeme') as ingredient_name, 
                   COALESCE(i.is_packaging, 0) as is_packaging,
                   COALESCE(u.unit_symbol, 'birim') as unit_symbol, 
                   ic.quantity, ic.total_cost 
            FROM ingredient_costs ic
            LEFT JOIN lu_ingredients i ON ic.ingredient_id = i.id
            LEFT JOIN lu_units u ON ic.unit_id = u.id
            ORDER BY i.ingredient_name ASC
          `);

          if (active) {
            if (ingResult && Array.isArray(ingResult)) setIngredients(ingResult);
            if (unitResult && Array.isArray(unitResult)) setUnits(unitResult);
            if (costResult && Array.isArray(costResult)) setCostList(costResult);

            if (route.params?.preselectedIngredientId) {
              setSelectedIngredientId(route.params.preselectedIngredientId);
            }
          }
        } catch (e) {
          console.log('CostScreen yükleme hatası:', e);
        }
      };
      load();
      return () => { active = false; };
    }, [route.params])
  );

  const fetchCosts = async () => {
    try {
      const result = await getSafeQuery(`
        SELECT ic.id, ic.ingredient_id, ic.unit_id, 
               COALESCE(i.ingredient_name, 'Bilinmeyen Malzeme') as ingredient_name, 
               COALESCE(i.is_packaging, 0) as is_packaging,
               COALESCE(u.unit_symbol, 'birim') as unit_symbol, 
               ic.quantity, ic.total_cost 
        FROM ingredient_costs ic
        LEFT JOIN lu_ingredients i ON ic.ingredient_id = i.id
        LEFT JOIN lu_units u ON ic.unit_id = u.id
        ORDER BY i.ingredient_name ASC
      `);
      if (result && Array.isArray(result)) setCostList(result);

      const ingResult = await getSafeQuery('SELECT * FROM lu_ingredients ORDER BY ingredient_name ASC');
      if (ingResult && Array.isArray(ingResult)) setIngredients(ingResult);
    } catch (e) {
      console.log('Maliyet çekme hatası:', e);
    }
  };

  const handleAddNewIngredient = async () => {
    const trimmedName = String(newIngName || '').trim();

    if (!trimmedName) {
      Alert.alert('Eksik Bilgi', 'Lütfen malzeme adını girin!');
      return;
    }

    try {
      const safeName = trimmedName.replace(/'/g, "''");

      const existingIng = await getSafeQuery(
        'SELECT id FROM lu_ingredients WHERE LOWER(ingredient_name) = LOWER(?)',
        [safeName]
      );

      if (existingIng && existingIng.length > 0 && existingIng[0].id) {
        Alert.alert('Zaten Kayıtlı', `"${trimmedName}" malzemesi sistemde zaten kayıtlı!`);
        setSelectedIngredientId(safeNum(existingIng[0].id));
        setNewIngName('');
        setIsPackagingItem(false);
        setShowAddIngModal(false);
        return;
      }

      await runSafeQuery(
        'INSERT INTO lu_ingredients (ingredient_name, is_packaging) VALUES (?, ?)',
        [safeName, isPackagingItem ? 1 : 0]
      );

      const newIng = await getSafeQuery(
        'SELECT id FROM lu_ingredients WHERE LOWER(ingredient_name) = LOWER(?)',
        [safeName]
      );
      if (newIng && newIng.length > 0 && newIng[0].id) {
        setSelectedIngredientId(safeNum(newIng[0].id));
      }

      Alert.alert('Başarılı', `"${trimmedName}" başarıyla eklendi!`);
      setNewIngName('');
      setIsPackagingItem(false);
      setShowAddIngModal(false);

      await fetchCosts();
    } catch (e) {
      console.log('Malzeme ekleme hatası:', e);
      Alert.alert('Hata', 'Malzeme eklenemedi: ' + e.message);
    }
  };

  const handleDeleteIngredientDirectly = (ingId, ingName) => {
    Alert.alert(
      "Malzemeyi Sil",
      `"${ingName}" malzemesini ve varsa maliyet kaydını sistemden tamamen silmek istiyor musunuz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDbConnection();
              if (!db) return;
              
              const validId = safeNum(ingId);
              if (validId > 0) {
                await db.runAsync(`DELETE FROM ingredient_costs WHERE ingredient_id = ${validId}`);
                await db.runAsync(`DELETE FROM lu_ingredients WHERE id = ${validId}`);
                
                await fetchCosts();
                if (selectedIngredientId === validId) setSelectedIngredientId('');
                Alert.alert('Başarılı', 'Malzeme sistemden tamamen silindi.');
              }
            } catch (e) {
              console.log('Malzeme silme hatası:', e);
              Alert.alert('Hata', 'Silinemedi: ' + e.message);
            }
          }
        }
      ]
    );
  };

  const isTimeUnit = (symbol) => {
    if (!symbol) return false;
    const s = String(symbol).toLowerCase().trim();
    return s === 'dk' || s === 'dakika' || s === 'min';
  };

  const selectedUnitObj = units.find(u => u.id === selectedUnitId);
  const isSelectedUnitTime = isTimeUnit(selectedUnitObj?.unit_symbol);

  const existingCostIngredientIds = costList.map(c => c.ingredient_id);

  const availableIngredients = ingredients.filter(ing => {
    const hasCost = existingCostIngredientIds.includes(ing.id);
    const isBeingEdited = editingCostId !== null && selectedIngredientId === ing.id;
    return !hasCost || isBeingEdited;
  });

  const handleSaveOrUpdate = async () => {
    const targetIngredientId = safeNum(selectedIngredientId);
    const targetUnitId = safeNum(selectedUnitId);
    const parsedTotalCost = safeNum(totalCost, true);

    let parsedQuantity = 0;
    if (isSelectedUnitTime) {
      parsedQuantity = safeNum(durationMinutes, true);
    } else {
      parsedQuantity = safeNum(quantity, true);
    }

    if (targetIngredientId === 0 || targetUnitId === 0 || parsedQuantity === 0 || parsedTotalCost === 0) {
      Alert.alert('Eksik Alan', 'Lütfen tüm alanları geçerli değerlerle doldurun!');
      return;
    }

    try {
      if (editingCostId) {
        const validEditingId = safeNum(editingCostId);
        if (validEditingId > 0) {
          await runSafeQuery(
            'UPDATE ingredient_costs SET ingredient_id = ?, unit_id = ?, quantity = ?, total_cost = ? WHERE id = ?',
            [targetIngredientId, targetUnitId, parsedQuantity, parsedTotalCost, validEditingId]
          );
          Alert.alert('Başarılı', 'Maliyet başarıyla güncellendi.');
        }
      } else {
        const existing = await getSafeQuery(
          'SELECT id FROM ingredient_costs WHERE ingredient_id = ?',
          [targetIngredientId]
        );

        if (existing && existing.length > 0 && existing[0].id) {
          Alert.alert('Zaten Kayıtlı', 'Bu malzeme için zaten bir maliyet kaydı var!');
          return;
        }

        await runSafeQuery(
          'INSERT INTO ingredient_costs (ingredient_id, unit_id, quantity, total_cost) VALUES (?, ?, ?, ?)',
          [targetIngredientId, targetUnitId, parsedQuantity, parsedTotalCost]
        );
        Alert.alert('Başarılı', 'Malzeme maliyeti kaydoldu.');
      }

      await fetchCosts();
      resetForm();
    } catch (e) {
      console.log('Maliyet kaydetme hatası:', e);
      Alert.alert('Hata', 'Maliyet kaydedilemedi: ' + e.message);
    }
  };

  const handleEdit = (item) => {
    setEditingCostId(item.id);
    setSelectedIngredientId(item.ingredient_id);
    setSelectedUnitId(item.unit_id);
    const unitObj = units.find(u => u.id === item.unit_id);
    if (isTimeUnit(unitObj?.unit_symbol)) {
      setDurationMinutes(item.quantity ? item.quantity.toString() : '');
      setQuantity('');
    } else {
      setQuantity(item.quantity ? item.quantity.toString() : '');
      setDurationMinutes('');
    }
    setTotalCost(item.total_cost ? item.total_cost.toString() : '');

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleDelete = async (item) => {
    Alert.alert(
      "Kaydı ve Malzemeyi Sil",
      `"${item.ingredient_name}" hem maliyet kaydı hem de malzeme havuzundan tamamen silinsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDbConnection();
              const validCostId = safeNum(item.id);
              const validIngId = safeNum(item.ingredient_id);

              if (validCostId > 0) {
                await db.runAsync(`DELETE FROM ingredient_costs WHERE id = ${validCostId}`);
              }
              if (validIngId > 0) {
                await db.runAsync(`DELETE FROM lu_ingredients WHERE id = ${validIngId}`);
              }
              await fetchCosts();
              Alert.alert('Başarılı', 'Kayıt ve malzeme tamamen silindi.');
            } catch (e) {
              console.log('Silme hatası:', e);
              Alert.alert('Hata', 'Silme sırasında sorun oluştu: ' + e.message);
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setEditingCostId(null);
    setSelectedIngredientId('');
    setSelectedUnitId('');
    setQuantity('');
    setDurationMinutes('');
    setTotalCost('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollViewRef} style={styles.padding} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.headerTitle}>Maliyet Yönetim Ekranı</Text>

        <TouchableOpacity 
          style={styles.topBackButton} 
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.topBackButtonText}>← Ana Ekrana Dön</Text>
        </TouchableOpacity>

        {/* Düzeltilen Bölüm: Alt alta yerleşim sayesinde buton ekrandan taşmaz */}
        <View style={styles.headerContainer}>
          <Text style={styles.label}>Malzeme / Ambalaj Seç (Silmek için üzerine uzun basın)</Text>
          <TouchableOpacity onPress={() => setShowAddIngModal(true)} style={styles.actionLinkBtn}>
            <Text style={styles.addText}>+ Yeni Malzeme / Ambalaj Ekle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipWrapContainer}>
          {availableIngredients.length === 0 ? (
            <Text style={{ fontStyle: 'italic', color: '#888', marginVertical: 5 }}>Maliyeti girilmemiş yeni malzeme bulunmuyor.</Text>
          ) : (
            availableIngredients.map((ing) => {
              const isSelected = selectedIngredientId === ing.id;
              const isPkg = ing.is_packaging === 1;
              return (
                <TouchableOpacity
                  key={ing.id}
                  style={[styles.chip, isSelected && styles.selectedChip]}
                  onPress={() => setSelectedIngredientId(ing.id)}
                  onLongPress={() => handleDeleteIngredientDirectly(ing.id, ing.ingredient_name)}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {ing.ingredient_name} {isPkg ? '📦' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <Text style={styles.label}>Ölçü Birimi Seç</Text>
        <View style={styles.chipWrapContainer}>
          {units.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.chip, selectedUnitId === u.id && styles.selectedChip]}
              onPress={() => setSelectedUnitId(u.id)}
            >
              <Text style={[styles.chipText, selectedUnitId === u.id && styles.selectedChipText]}>
                {u.unit_symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, isSelectedUnitTime && { color: '#AAA' }]}>
          Miktar {isSelectedUnitTime ? '(Süre bazlı birim seçildiğinde pasiftir)' : '(Örn: Toplu alış adedi, örn: 100)'}
        </Text>
        <TextInput 
          style={[styles.input, isSelectedUnitTime && styles.disabledInput]} 
          placeholder={isSelectedUnitTime ? "Süre alanı aşağıdadır" : "Örn: 100 veya 1000"} 
          keyboardType="numeric" 
          editable={!isSelectedUnitTime}
          value={isSelectedUnitTime ? '' : quantity} 
          onChangeText={setQuantity} 
        />

        <Text style={[styles.label, !isSelectedUnitTime && { color: '#AAA' }]}>
          Süre (Dakika) {!isSelectedUnitTime ? '(Yalnızca dk/dakika birimi seçilirse aktif olur)' : '(Aktif)'}
        </Text>
        <TextInput 
          style={[styles.input, !isSelectedUnitTime && styles.disabledInput]} 
          placeholder={isSelectedUnitTime ? "Örn: 30 (30 dakika için)" : "Ölçü birimi dk seçilmelidir"} 
          keyboardType="numeric" 
          editable={isSelectedUnitTime}
          value={isSelectedUnitTime ? durationMinutes : ''} 
          onChangeText={setDurationMinutes} 
        />

        <Text style={styles.label}>Toplam Maliyet (TL) (Örn: 100 adet için 250 TL)</Text>
        <TextInput style={styles.input} placeholder="Örn: 250" keyboardType="numeric" value={totalCost} onChangeText={setTotalCost} />

        <TouchableOpacity style={[styles.saveButton, editingCostId && styles.updateButton]} onPress={handleSaveOrUpdate}>
          <Text style={styles.saveButtonText}>{editingCostId ? 'Maliyeti Güncelle' : 'Maliyeti Kaydet'}</Text>
        </TouchableOpacity>
        {editingCostId !== null ? (
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>Vazgeç</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Kayıtlı Malzeme ve Ambalaj Maliyetleri</Text>
        <View style={{ marginBottom: 20 }}>
          {costList.length === 0 ? (
            <Text style={{ fontStyle: 'italic', color: '#888', marginTop: 5 }}>Henüz kayıtlı maliyet bulunmuyor.</Text>
          ) : (
            costList.map((item) => (
              <View key={item.id} style={styles.costCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.costCardTitle}>
                    {item.ingredient_name} {item.is_packaging === 1 ? '📦 (Ambalaj/Kutu)' : ''}
                  </Text>
                  <Text style={styles.costCardDetail}>
                    <Text>{item.quantity} {item.unit_symbol} = </Text>
                    <Text style={styles.bold}>{item.total_cost} TL</Text>
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                    <Text style={styles.btnText}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.btnText}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Yeni Malzeme / Ambalaj Ekleme Modalı */}
      <Modal visible={showAddIngModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Malzeme veya Ambalaj Ekle</Text>
            <TextInput style={styles.input} placeholder="Adı (Örn: 750ml Plastik Kutu)" value={newIngName} onChangeText={setNewIngName} />
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Bu bir Ambalaj / Kutu Malzemesidir</Text>
              <Switch
                value={isPackagingItem}
                onValueChange={setIsPackagingItem}
                trackColor={{ false: '#767577', true: '#38808A' }}
                thumbColor={isPackagingItem ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddNewIngredient}>
                <Text style={styles.saveButtonText}>Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowAddIngModal(false); setIsPackagingItem(false); setNewIngName(''); }}>
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  padding: { padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#38808A', marginBottom: 15 },
  topBackButton: { backgroundColor: '#EEE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignSelf: 'flex-start', marginBottom: 10 },
  topBackButtonText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  headerContainer: { marginTop: 10, marginBottom: 5 }, // Dikey yerleşim konteyneri
  actionLinkBtn: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 5 }, // Butonu sağ alta hizalama
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  addText: { color: '#38808A', fontWeight: 'bold', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#FFF' },
  disabledInput: { backgroundColor: '#E9ECEF', color: '#6C757D' },
  chipWrapContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', marginRight: 8, marginBottom: 8 },
  selectedChip: { backgroundColor: '#38808A' },
  chipText: { color: '#333', fontWeight: '500' },
  selectedChipText: { color: '#FFF' },
  saveButton: { backgroundColor: '#38808A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  updateButton: { backgroundColor: '#2E7D32' },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelButtonText: { color: '#D32F2F', fontWeight: 'bold' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 25, marginBottom: 10, color: '#000' },
  costCard: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E9ECEF', flexDirection: 'row', alignItems: 'center' },
  costCardTitle: { fontWeight: 'bold', fontSize: 15 },
  costCardDetail: { color: '#555', marginTop: 4 },
  bold: { color: '#2B7A78', fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row' },
  editBtn: { backgroundColor: '#FFA000', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, marginRight: 5 },
  deleteBtn: { backgroundColor: '#D32F2F', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15, paddingHorizontal: 5 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  modalSaveBtn: { backgroundColor: '#38808A', padding: 12, borderRadius: 8, flex: 1, alignItems: 'center', marginRight: 5 }
});