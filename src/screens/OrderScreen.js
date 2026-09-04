import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { getDbConnection } from '../database/database';
import { safeNum, runSafeQuery, getSafeQuery } from '../database/databaseHelper';

export default function OrderScreen({ navigation }) {
  const [meals, setMeals] = useState([]);
  const [units, setUnits] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [packagingList, setPackagingList] = useState([]);

  const [customerName, setCustomerName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  
  const [notes, setNotes] = useState('');

  const [orderItems, setOrderItems] = useState([]);
  const [selectedMealId, setSelectedMealId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const [selectedPackagings, setSelectedPackagings] = useState({});

  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');

  const hoursList = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutesList = ['00', '15', '30', '45'];
  const recipeMealIds = recipes.map(r => r.meal_id);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const db = await getDbConnection();
          if (!db) return;

          const m = await db.getAllAsync('SELECT * FROM lu_meals ORDER BY meal_name ASC');
          const u = await db.getAllAsync('SELECT * FROM lu_units');
          const r = await db.getAllAsync(`
            SELECT r.*, u.unit_symbol as portion_unit_symbol 
            FROM recipes r
            LEFT JOIN lu_units u ON r.portion_unit_id = u.id
          `);

          const packagings = await db.getAllAsync(`
            SELECT i.id, i.ingredient_name, ic.total_cost, ic.quantity, ic.unit_id, u.unit_symbol
            FROM lu_ingredients i
            LEFT JOIN ingredient_costs ic ON i.id = ic.ingredient_id
            LEFT JOIN lu_units u ON ic.unit_id = u.id
            WHERE i.is_packaging = 1
          `);

          if (active) {
            if (m && Array.isArray(m)) setMeals(m);
            if (u && Array.isArray(u)) setUnits(u);
            if (r && Array.isArray(r)) setRecipes(r);
            if (packagings && Array.isArray(packagings)) setPackagingList(packagings);
          }

          await fetchOrders(db, r || [], u || []);
        } catch (e) {
          console.log('OrderScreen yükleme hatası:', e);
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  const getConversionFactor = (fromUnitSymbol, toUnitSymbol) => {
    if (!fromUnitSymbol || !toUnitSymbol || fromUnitSymbol === toUnitSymbol) return 1;
    const from = fromUnitSymbol.toLowerCase();
    const to = toUnitSymbol.toLowerCase();

    if (from === 'kg' && to === 'gr') return 1 / 1000;
    if (from === 'gr' && to === 'kg') return 1000;
    if (from === 'lt' && to === 'mlt') return 1 / 1000;
    if (from === 'mlt' && to === 'lt') return 1000;
    return 1;
  };

  const fetchOrders = async (dbInstance, recipeList, unitList) => {
    try {
      const db = dbInstance || await getDbConnection();
      if (!db) return;

      const orderList = await db.getAllAsync('SELECT * FROM orders ORDER BY id DESC');

      for (let o of (orderList || [])) {
        const items = await db.getAllAsync(`
          SELECT oi.quantity, m.meal_name, u.unit_symbol, oi.meal_id, oi.unit_id, oi.item_cost, oi.item_sale
          FROM order_items oi
          LEFT JOIN lu_meals m ON oi.meal_id = m.id
          LEFT JOIN lu_units u ON oi.unit_id = u.id
          WHERE oi.order_id = ${safeNum(o.id)}
        `);

        o.items = (items || []).map(item => {
          if (item.item_cost !== null && item.item_cost !== undefined && item.item_cost > 0) {
            return { 
              ...item, 
              item_cost: item.item_cost, 
              item_sale: item.item_sale || 0 
            };
          }

          const recipeMatch = (recipeList || []).find(rec => rec.meal_id === item.meal_id);
          if (!recipeMatch) return { ...item, item_cost: 0, item_sale: 0 };

          const baseCost = recipeMatch.calculated_cost || 0;
          const baseSale = recipeMatch.sale_price || 0;
          const basePortion = recipeMatch.portion_quantity || 1;
          const recipeUnitSymbol = recipeMatch.portion_unit_symbol;
          const orderUnitSymbol = item.unit_symbol;

          const factor = getConversionFactor(recipeUnitSymbol, orderUnitSymbol);
          const calculatedCost = (item.quantity * factor / basePortion) * baseCost;
          const calculatedSale = (item.quantity * factor / basePortion) * baseSale;

          return { ...item, item_cost: calculatedCost, item_sale: calculatedSale };
        });

        const packagingsUsed = await db.getAllAsync(`
          SELECT op.quantity_used, i.ingredient_name, ic.total_cost, ic.quantity
          FROM order_packagings op
          LEFT JOIN lu_ingredients i ON op.ingredient_id = i.id
          LEFT JOIN ingredient_costs ic ON i.id = ic.ingredient_id
          WHERE op.order_id = ${safeNum(o.id)}
        `);

        o.packagings = (packagingsUsed || []).map(p => {
          const bulkPrice = p.total_cost || 0;
          const bulkQty = p.quantity || 1;
          const unitPrice = bulkQty > 0 ? bulkPrice / bulkQty : 0;
          return {
            ...p,
            total_packaging_cost: p.quantity_used * unitPrice
          };
        });
      }

      if (orderList && Array.isArray(orderList)) setOrders(orderList);
    } catch (e) {
      console.log('Sipariş listesi çekme hatası:', e);
    }
  };

  const handleAddMeal = async () => {
    const rawInput = newMealName ? String(newMealName) : '';
    const trimmedMealName = rawInput.trim();

    if (!trimmedMealName) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir yemek adı girin!');
      return;
    }

    try {
      const db = await getDbConnection();
      if (!db) return;

      const safeMealName = trimmedMealName.replace(/'/g, "''");
      const existingMeal = await db.getFirstAsync(`SELECT id FROM lu_meals WHERE LOWER(meal_name) = LOWER('${safeMealName}')`);

      if (existingMeal) {
        Alert.alert('Zaten Kayıtlı', `"${trimmedMealName}" isimli yemek zaten mevcut! Otomatik seçildi.`);
        setSelectedMealId(safeNum(existingMeal.id));
        setNewMealName('');
        setShowAddMealModal(false);
        return;
      }

      const res = await db.runAsync(`INSERT INTO lu_meals (meal_name) VALUES ('${safeMealName}')`);
      setNewMealName('');
      setShowAddMealModal(false);

      const allMeals = await db.getAllAsync('SELECT * FROM lu_meals ORDER BY meal_name ASC');
      if (allMeals && Array.isArray(allMeals)) setMeals(allMeals);

      const insertedId = res?.lastInsertRowId ?? res?.insertId;
      if (insertedId) setSelectedMealId(safeNum(insertedId));
    } catch (e) {
      console.log('Yemek ekleme hatası:', e);
      Alert.alert('Hata', 'Yemek eklenirken bir sorun oluştu.');
    }
  };

  const handleAddOrderItem = () => {
    const mealIdNum = safeNum(selectedMealId);
    const unitIdNum = safeNum(selectedUnitId);
    const qtyNum = safeNum(currentQty, true);

    if (mealIdNum === 0 || unitIdNum === 0 || qtyNum === 0) {
      Alert.alert('Eksik Seçim', 'Lütfen yemek, miktar ve ölçü birimini doğru seçin!');
      return;
    }

    const mealObj = meals.find(m => m.id === mealIdNum);
    const unitObj = units.find(u => u.id === unitIdNum);
    const recipeMatch = recipes.find(r => r.meal_id === mealIdNum);

    const baseCost = recipeMatch ? recipeMatch.calculated_cost : 0;
    const baseSale = recipeMatch ? recipeMatch.sale_price : 0;
    const basePortion = recipeMatch ? recipeMatch.portion_quantity : 1;
    const recipeUnitSymbol = recipeMatch ? recipeMatch.portion_unit_symbol : 'birim';
    const orderUnitSymbol = unitObj ? unitObj.unit_symbol : 'birim';

    const factor = getConversionFactor(recipeUnitSymbol, orderUnitSymbol);
    const calculatedItemCost = (qtyNum * factor / basePortion) * baseCost;
    const calculatedItemSale = (qtyNum * factor / basePortion) * baseSale;

    const newItem = {
      id: Date.now(),
      meal_id: mealIdNum,
      meal_name: mealObj ? mealObj.meal_name : 'Yemek',
      quantity: qtyNum,
      unit_id: unitIdNum,
      unit_symbol: orderUnitSymbol,
      item_cost: calculatedItemCost,
      item_sale: calculatedItemSale
    };

    setOrderItems([...orderItems, newItem]);
    setCurrentQty('');
  };

  const handleRemoveItem = (indexToRemove) => {
    setOrderItems(prevItems => prevItems.filter((_, index) => index !== indexToRemove));
  };

  const handlePackagingQtyChange = (packagingId, value) => {
    setSelectedPackagings(prev => ({
      ...prev,
      [packagingId]: value
    }));
  };

  const handleSaveOrder = async () => {
    const trimmedCustomer = String(customerName || '').trim();
    if (!trimmedCustomer) {
      Alert.alert('Eksik Bilgi', 'Lütfen müşteri adını girin!');
      return;
    }
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen siparişe en az 1 yemek ekleyin!');
      return;
    }

    const formattedDate = deliveryDate ? deliveryDate.toISOString().split('T')[0] : '';
    const formattedTime = `${selectedHour || '00'}:${selectedMinute || '00'}`;
    const fullDelivery = `${formattedDate} ${formattedTime}`.trim();
    const safeCustomer = trimmedCustomer.replace(/'/g, "''");
    const safeNotes = notes ? String(notes).replace(/'/g, "''").trim() : '';

    try {
      const res = await runSafeQuery(
        'INSERT INTO orders (customer_name, delivery_datetime, notes, status) VALUES (?, ?, ?, ?)',
        [safeCustomer, fullDelivery, safeNotes, 'pending']
      );

      const newOrderId = res?.lastInsertRowId ?? res?.insertId;

      if (newOrderId && newOrderId > 0) {
        for (const item of orderItems) {
          const itemMealId = safeNum(item.meal_id);
          const itemQty = safeNum(item.quantity, true);
          const itemUnitId = safeNum(item.unit_id);
          const itemCostVal = safeNum(item.item_cost, true);
          const itemSaleVal = safeNum(item.item_sale, true);

          if (itemMealId > 0 && itemQty > 0 && itemUnitId > 0) {
            await runSafeQuery(
              'INSERT INTO order_items (order_id, meal_id, quantity, unit_id, item_cost, item_sale) VALUES (?, ?, ?, ?, ?, ?)',
              [safeOrderIdNum(newOrderId), itemMealId, itemQty, itemUnitId, itemCostVal, itemSaleVal]
            );
          }
        }

        for (const [pkgId, qtyStr] of Object.entries(selectedPackagings)) {
          const qtyUsed = safeNum(qtyStr, true);
          if (qtyUsed > 0) {
            await runSafeQuery(
              'INSERT INTO order_packagings (order_id, ingredient_id, quantity_used) VALUES (?, ?, ?)',
              [safeOrderIdNum(newOrderId), safeNum(pkgId), qtyUsed]
            );
          }
        }
      }

      Alert.alert('Başarılı', 'Sipariş başarıyla kaydedildi!');
      const dbConn = await getDbConnection();
      if (dbConn) {
        await fetchOrders(dbConn, recipes, units);
      }
      resetForm();
    } catch (e) {
      console.log('Sipariş kaydetme hatası:', e);
      Alert.alert('Veritabanı Hatası', 'Sipariş kaydedilemedi: ' + e.message);
    }
  };

  const safeOrderIdNum = (id) => {
    const num = parseInt(id, 10);
    return isNaN(num) ? 0 : num;
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const db = await getDbConnection();
      const validId = safeNum(orderId);
      if (validId > 0) {
        await db.runAsync(`UPDATE orders SET status = '${newStatus}' WHERE id = ${validId}`);
        await fetchOrders(db, recipes, units);
      }
    } catch (e) {
      console.log('Durum güncelleme hatası:', e);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDeliveryDate(selectedDate);
  };

  const resetForm = () => {
    setCustomerName('');
    setDeliveryDate(new Date());
    setSelectedHour('12');
    setSelectedMinute('00');
    setShowHourPicker(false);
    setShowMinutePicker(false);
    setNotes('');
    setOrderItems([]);
    setSelectedMealId('');
    setSelectedUnitId('');
    setSelectedPackagings({});
  };

  const filteredOrders = orders.filter(o => o.status === activeTab);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.padding} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.headerTitle}>Sipariş Giriş & Takip Ekranı</Text>

        {/* Üst Butonlar (Ana Ekrana Dön ve Durum Raporu) */}
        <View style={styles.topButtonsRow}>
          <TouchableOpacity 
            style={styles.topBackButton} 
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.topBackButtonText}>← Ana Ekrana Dön</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.topReportButton} 
            onPress={() => navigation.navigate('Report')}
          >
            <Text style={styles.topReportButtonText}>📊 Durum Raporu</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Müşteri Adı Soyadı</Text>
        <TextInput style={styles.input} placeholder="Örn: Ferda Derici" value={customerName} onChangeText={setCustomerName} />

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Siparişe Konu Yemekler</Text>
          <TouchableOpacity onPress={() => setShowAddMealModal(true)}>
            <Text style={styles.addText}>+ Yeni Yemek Ekle</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipWrapContainer}>
          {meals.map((m) => {
            const hasRecipe = recipeMealIds.includes(m.id);
            const isSelected = selectedMealId === m.id;

            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.chip,
                  isSelected && styles.selectedChip,
                  !hasRecipe && styles.disabledChipStyle
                ]}
                disabled={!hasRecipe}
                onPress={() => setSelectedMealId(m.id)}
              >
                <Text style={[
                  styles.chipText,
                  isSelected && styles.selectedChipText,
                  !hasRecipe && styles.disabledChipText
                ]}>
                  {String(m.meal_name || '')} {!hasRecipe ? ' (Reçetesi Yok)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>İstenen Ölçü Birimi ve Miktar</Text>
        <View style={styles.chipWrapContainer}>
          {units.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.chipSmall, selectedUnitId === u.id && styles.selectedChip]}
              onPress={() => setSelectedUnitId(u.id)}
            >
              <Text style={[styles.chipText, selectedUnitId === u.id && styles.selectedChipText]}>{u.unit_symbol}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} placeholder="Miktar (Örn: 500)" keyboardType="numeric" value={currentQty} onChangeText={setCurrentQty} />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddOrderItem}>
            <Text style={styles.addBtnText}>+ Siparişe Ekle</Text>
          </TouchableOpacity>
        </View>

        {orderItems.map((item, index) => (
          <View key={index} style={[styles.itemRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={[styles.itemText, { flex: 1 }]}>
              {item.meal_name} - {item.quantity} {item.unit_symbol} (Maliyet: {item.item_cost.toFixed(2)} TL | Satış: {item.item_sale.toFixed(2)} TL)
            </Text>
            <TouchableOpacity 
              style={styles.removeItemButton} 
              onPress={() => handleRemoveItem(index)}
            >
              <Text style={styles.removeItemText}>✖</Text>
            </TouchableOpacity>
          </View>
        ))}

        {packagingList.length > 0 ? (
          <View style={{ marginTop: 15 }}>
            <Text style={styles.sectionTitle}>📦 Paketleme / Ambalaj Kullanımı</Text>
            {packagingList.map((pkg) => (
              <View key={pkg.id} style={styles.packagingInputRow}>
                <Text style={{ flex: 1, fontSize: 14, color: '#333', fontWeight: '500' }}>
                  {pkg.ingredient_name} ({pkg.unit_symbol || 'adet'})
                </Text>
                <TextInput
                  style={styles.packagingInput}
                  placeholder="Adet"
                  keyboardType="numeric"
                  value={selectedPackagings[pkg.id] || ''}
                  onChangeText={(val) => handlePackagingQtyChange(pkg.id, val)}
                />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Teslim Tarihi</Text>
        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.datePickerText}>{deliveryDate.toISOString().split('T')[0]}</Text>
        </TouchableOpacity>
        {showDatePicker ? (
          <DateTimePicker value={deliveryDate} mode="date" display="default" onChange={onDateChange} />
        ) : null}

        <Text style={styles.label}>
          <Text>Teslim Saati: </Text>
          <Text style={styles.selectedTimeText}>{selectedHour + ':' + selectedMinute}</Text>
        </Text>
        
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.dropdownBtn, { flex: 1, marginRight: 5 }]} 
            onPress={() => { setShowHourPicker(!showHourPicker); setShowMinutePicker(false); }}
          >
            <Text style={styles.dropdownBtnText}>⏰ Saat: {selectedHour}:00 {showHourPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.dropdownBtn, { flex: 1, marginLeft: 5 }]} 
            onPress={() => { setShowMinutePicker(!showMinutePicker); setShowHourPicker(false); }}
          >
            <Text style={styles.dropdownBtnText}>⏱️ Dakika: :{selectedMinute} {showMinutePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>

        {showHourPicker ? (
          <View style={styles.expandableHourContainer}>
            <Text style={styles.subLabel}>Saati Yana Kaydırarak Seçin:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.timeScrollRow}>
              {hoursList.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.timeChip, selectedHour === h && styles.selectedTimeChip]}
                  onPress={() => { setSelectedHour(h); setShowHourPicker(false); }}
                >
                  <Text style={[styles.timeChipText, selectedHour === h && styles.selectedTimeChipText]}>{h + ':00'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {showMinutePicker ? (
          <View style={styles.expandableHourContainer}>
            <Text style={styles.subLabel}>Dakikayı Seçin:</Text>
            <View style={styles.chipWrapContainer}>
              {minutesList.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.timeChip, selectedMinute === m && styles.selectedTimeChip]}
                  onPress={() => { setSelectedMinute(m); setShowMinutePicker(false); }}
                >
                  <Text style={[styles.timeChipText, selectedMinute === m && styles.selectedTimeChipText]}>{':' + m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Sipariş Notu / Özel İstekler</Text>
        <TextInput style={[styles.input, { height: 60 }]} multiline placeholder="Örn: Sosu ayrı paketlensin" value={notes} onChangeText={setNotes} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveOrder}>
          <Text style={styles.saveButtonText}>Siparişi Kaydet (Hazırlanıyor)</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Sipariş Takip & Arşiv</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'pending' && styles.activeTab]} onPress={() => setActiveTab('pending')}>
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Hazırlanıyor ({orders.filter(o => o.status === 'pending').length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'completed' && styles.activeTab]} onPress={() => setActiveTab('completed')}>
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>Teslim Edildi ({orders.filter(o => o.status === 'completed').length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'canceled' && styles.activeTab]} onPress={() => setActiveTab('canceled')}>
            <Text style={[styles.tabText, activeTab === 'canceled' && styles.activeTabText]}>İptal ({orders.filter(o => o.status === 'canceled').length})</Text>
          </TouchableOpacity>
        </View>

        {filteredOrders.length === 0 ? (
          <Text style={styles.emptyText}>Bu kategoride henüz kayıtlı sipariş bulunmuyor.</Text>
        ) : (
          filteredOrders.map((order) => {
            const itemsCost = order.items ? order.items.reduce((sum, i) => sum + (i.item_cost || 0), 0) : 0;
            const packagingsCost = order.packagings ? order.packagings.reduce((sum, p) => sum + (p.total_packaging_cost || 0), 0) : 0;
            const totalOrderCost = itemsCost + packagingsCost;
            
            const totalOrderSale = order.items ? order.items.reduce((sum, i) => sum + (i.item_sale || 0), 0) : 0;
            const netProfit = totalOrderSale - totalOrderCost;

            return (
              <View key={order.id} style={styles.orderCard}>
                <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                <Text style={styles.orderDetail}>Teslim: {order.delivery_datetime}</Text>
                {order.notes ? <Text style={styles.orderNotes}>Not: {order.notes}</Text> : null}

                {order.items && order.items.map((it, idx) => (
                  <Text key={idx} style={styles.orderItemBullet}>• {it.meal_name} ({it.quantity} {it.unit_symbol})</Text>
                ))}

                {order.packagings && order.packagings.length > 0 ? (
                  <View style={{ marginTop: 4, marginLeft: 5 }}>
                    {order.packagings.map((pkg, pIdx) => (
                      <Text key={`pkg-${pIdx}`} style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>
                        📦 {pkg.ingredient_name}: {pkg.quantity_used} adet ({pkg.total_packaging_cost.toFixed(2)} TL)
                      </Text>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.totalCostText}>
                  <Text>Toplam Üretim Maliyeti: </Text>
                  <Text style={{ color: '#2E7D32' }}>{totalOrderCost.toFixed(2)} TL</Text>
                </Text>
                <Text style={styles.totalSaleText}>
                  <Text>Toplam Satış Tutarı: </Text>
                  <Text style={{ color: '#C62828' }}>{totalOrderSale.toFixed(2)} TL</Text>
                </Text>
                <Text style={styles.netProfitText}>
                  <Text>Net Kâr: </Text>
                  <Text style={{ color: netProfit >= 0 ? '#1976D2' : '#D32F2F', fontWeight: 'bold' }}>
                    {netProfit.toFixed(2)} TL
                  </Text>
                </Text>

                {order.status === 'pending' ? (
                  <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.completeBtn} onPress={() => handleUpdateStatus(order.id, 'completed')}>
                      <Text style={styles.btnText}>✓ Teslim Edildi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => handleUpdateStatus(order.id, 'canceled')}>
                      <Text style={styles.btnText}>X İptal Et</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showAddMealModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Yemek Ekle</Text>
            <TextInput style={styles.input} placeholder="Yemek Adı" value={newMealName} onChangeText={setNewMealName} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddMeal}><Text style={styles.saveButtonText}>Ekle</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddMealModal(false)}><Text style={styles.cancelButtonText}>İptal</Text></TouchableOpacity>
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#38808A', marginBottom: 5 },
  topButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  topBackButton: { backgroundColor: '#EEE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  topBackButtonText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  topReportButton: { backgroundColor: '#38808A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  topReportButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  addText: { color: '#38808A', fontWeight: 'bold', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 10, marginBottom: 5 },
  subLabel: { fontSize: 12, color: '#666', marginTop: 6, marginBottom: 4 },
  selectedTimeText: { color: '#38808A', fontWeight: 'bold', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#FFF' },
  datePickerBtn: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, backgroundColor: '#FAFAFA' },
  datePickerText: { fontSize: 15, color: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  chipWrapContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', marginRight: 8, marginBottom: 8 },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, backgroundColor: '#E0E0E0', marginRight: 5, marginBottom: 8 },
  selectedChip: { backgroundColor: '#38808A' },
  chipText: { color: '#333', fontWeight: '500' },
  selectedChipText: { color: '#FFF' },
  dropdownBtn: { backgroundColor: '#F0F4F8', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CED4DA', marginBottom: 5, alignItems: 'center' },
  dropdownBtnText: { fontSize: 13, fontWeight: 'bold', color: '#38808A' },
  expandableHourContainer: { backgroundColor: '#FAFAFA', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E9ECEF', marginBottom: 8 },
  timeScrollRow: { flexDirection: 'row', paddingVertical: 5 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E0E0E0', marginRight: 6, marginBottom: 4 },
  selectedTimeChip: { backgroundColor: '#38808A' },
  timeChipText: { fontSize: 14, fontWeight: 'bold', color: '#444' },
  selectedTimeChipText: { color: '#FFF' },
  addBtn: { backgroundColor: '#38808A', padding: 12, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, color: '#000', marginBottom: 8 },
  itemRow: { backgroundColor: '#F0F4F8', padding: 8, borderRadius: 6, marginTop: 4 },
  itemText: { fontWeight: '500', color: '#333', fontSize: 13 },
  removeItemButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  removeItemText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 14 },
  packagingInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 8, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#E9ECEF' },
  packagingInput: { width: 70, borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 6, backgroundColor: '#FFF', textAlign: 'center', fontSize: 14 },
  saveButton: { backgroundColor: '#38808A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', marginVertical: 15, backgroundColor: '#F0F0F0', borderRadius: 8, padding: 3 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: { backgroundColor: '#38808A' },
  tabText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
  activeTabText: { color: '#FFF' },
  emptyText: { fontStyle: 'italic', color: '#888', textAlign: 'center', marginVertical: 15 },
  orderCard: { backgroundColor: '#F9F9F9', padding: 15, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  orderCustomer: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  orderDetail: { fontSize: 13, color: '#666', marginVertical: 2 },
  orderNotes: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 5 },
  orderItemBullet: { fontSize: 13, color: '#444', marginLeft: 5 },
  totalCostText: { fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  totalSaleText: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  netProfitText: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  orderActions: { flexDirection: 'row', marginTop: 12 },
  completeBtn: { backgroundColor: '#2E7D32', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginRight: 8 },
  cancelBtn: { backgroundColor: '#D32F2F', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  modalSaveBtn: { backgroundColor: '#38808A', padding: 12, borderRadius: 8, flex: 1, alignItems: 'center', marginRight: 5 },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelButtonText: { color: '#D32F2F', fontWeight: 'bold' },
  disabledChipStyle: { backgroundColor: '#F1F3F5', opacity: 0.6, borderWidth: 1, borderColor: '#DEE2E6' },
  disabledChipText: { color: '#ADB5BD', textDecorationLine: 'line-through' },
});