import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDbConnection } from '../database/database';
import { safeNum, getSafeQuery, runSafeQuery } from '../database/databaseHelper';

export default function RecipeScreen({ navigation }) {
  const scrollViewRef = useRef(null);

  const [meals, setMeals] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [units, setUnits] = useState([]);
  const [costs, setCosts] = useState([]);

  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [selectedMealId, setSelectedMealId] = useState('');
  const [portionQty, setPortionQty] = useState('1');
  const [selectedPortionUnitId, setSelectedPortionUnitId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [cookingTime, setCookingTime] = useState('');

  const [recipeItems, setRecipeItems] = useState([]);
  const [currentIngredientId, setCurrentIngredientId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentUnitId, setCurrentUnitId] = useState('');

  const [calculatedCost, setCalculatedCost] = useState(0);
  const [recipeList, setRecipeList] = useState([]);

  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [showAddIngModal, setShowAddIngModal] = useState(false);
  const [newIngName, setNewIngName] = useState('');

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState(null);

  const isTimeUnit = (symbol) => {
    if (!symbol) return false;
    const s = String(symbol).toLowerCase().trim();
    return s === 'dk' || s === 'dakika' || s === 'min';
  };

  const computeRecipeCost = (items, cookingDuration, currentCosts, currentUnits) => {
    let total = 0;
    const totalCookingTime = safeNum(cookingDuration, true);

    (items || []).forEach(item => {
      const matchCost = currentCosts.find(c => c.ingredient_id === item.ingredient_id);
      if (matchCost && matchCost.quantity > 0) {
        let basePricePerUnit = matchCost.total_cost / matchCost.quantity;
        const costUnit = currentUnits.find(u => u.id === matchCost.unit_id)?.unit_symbol;
        const recipeUnit = item.unit_symbol;

        if (isTimeUnit(recipeUnit) || isTimeUnit(costUnit)) {
          let effectiveMinutes = totalCookingTime > 0 ? totalCookingTime : item.quantity;
          total += effectiveMinutes * basePricePerUnit;
        } else {
          let conversionFactor = 1;
          if (costUnit === 'kg' && recipeUnit === 'gr') conversionFactor = 1 / 1000;
          else if (costUnit === 'gr' && recipeUnit === 'kg') conversionFactor = 1000;
          else if (costUnit === 'lt' && recipeUnit === 'mlt') conversionFactor = 1 / 1000;
          else if (costUnit === 'mlt' && recipeUnit === 'lt') conversionFactor = 1000;

          total += item.quantity * (basePricePerUnit * conversionFactor);
        }
      }
    });
    return total;
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const m = await getSafeQuery('SELECT * FROM lu_meals ORDER BY meal_name ASC');
          const i = await getSafeQuery('SELECT * FROM lu_ingredients ORDER BY ingredient_name ASC');
          const u = await getSafeQuery('SELECT * FROM lu_units');
          const c = await getSafeQuery('SELECT * FROM ingredient_costs');

          if (active) {
            if (m && Array.isArray(m)) setMeals(m);
            if (i && Array.isArray(i)) setIngredients(i);
            if (u && Array.isArray(u)) setUnits(u);
            if (c && Array.isArray(c)) setCosts(c);
          }

          const recipes = await getSafeQuery(`
            SELECT r.id, r.meal_id, m.meal_name, r.portion_quantity, r.portion_unit_id, 
                   COALESCE(u.unit_symbol, 'birim') as portion_unit_symbol, 
                   r.cooking_time, r.calculated_cost, r.sale_price
            FROM recipes r
            LEFT JOIN lu_meals m ON r.meal_id = m.id
            LEFT JOIN lu_units u ON r.portion_unit_id = u.id
            ORDER BY r.id DESC
          `);

          for (let r of (recipes || [])) {
            const items = await getSafeQuery(`
              SELECT ri.ingredient_id, i.ingredient_name, ri.quantity, ri.unit_id, u.unit_symbol
              FROM recipe_items ri
              LEFT JOIN lu_ingredients i ON ri.ingredient_id = i.id
              LEFT JOIN lu_units u ON ri.unit_id = u.id
              WHERE ri.recipe_id = ${safeNum(r.id)}
            `);
            r.items = items || [];
            r.calculated_cost = computeRecipeCost(r.items, r.cooking_time, c || [], u || []);
          }

          if (active && recipes && Array.isArray(recipes)) {
            setRecipeList(recipes);
          }
        } catch (e) {
          console.log('RecipeScreen yükleme hatası:', e);
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    const total = computeRecipeCost(recipeItems, cookingTime, costs, units);
    setCalculatedCost(total);
  }, [recipeItems, costs, units, cookingTime]);

  const fetchRecipes = async () => {
    try {
      const u = units.length > 0 ? units : (await getSafeQuery('SELECT * FROM lu_units') || []);
      const c = costs.length > 0 ? costs : (await getSafeQuery('SELECT * FROM ingredient_costs') || []);

      const recipes = await getSafeQuery(`
        SELECT r.id, r.meal_id, m.meal_name, r.portion_quantity, r.portion_unit_id, 
               COALESCE(u.unit_symbol, 'birim') as portion_unit_symbol, 
               r.cooking_time, r.calculated_cost, r.sale_price
            FROM recipes r
            LEFT JOIN lu_meals m ON r.meal_id = m.id
            LEFT JOIN lu_units u ON r.portion_unit_id = u.id
            ORDER BY r.id DESC
      `);

      for (let r of (recipes || [])) {
        const items = await getSafeQuery(`
          SELECT ri.ingredient_id, i.ingredient_name, ri.quantity, ri.unit_id, u.unit_symbol
          FROM recipe_items ri
          LEFT JOIN lu_ingredients i ON ri.ingredient_id = i.id
          LEFT JOIN lu_units u ON ri.unit_id = u.id
          WHERE ri.recipe_id = ${safeNum(r.id)}
        `);
        r.items = items || [];
        r.calculated_cost = computeRecipeCost(r.items, r.cooking_time, c, u);
      }

      if (recipes && Array.isArray(recipes)) setRecipeList(recipes);
    } catch (e) {
      console.log('Tarif çekme hatası:', e);
    }
  };

  const handleAddMeal = async () => {
    const trimmedMealName = String(newMealName || '').trim();

    if (!trimmedMealName) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir yemek adı girin!');
      return;
    }

    try {
      const safeMealName = trimmedMealName.replace(/'/g, "''");

      await runSafeQuery('INSERT OR IGNORE INTO lu_meals (meal_name) VALUES (?)', [safeMealName]);

      const existingMeals = await getSafeQuery(
        'SELECT id FROM lu_meals WHERE LOWER(meal_name) = LOWER(?)',
        [safeMealName]
      );

      if (existingMeals && existingMeals.length > 0 && existingMeals[0].id) {
        setSelectedMealId(safeNum(existingMeals[0].id));
      }
      
      setNewMealName('');
      setShowAddMealModal(false);

      const m = await getSafeQuery('SELECT * FROM lu_meals ORDER BY meal_name ASC');
      if (m && Array.isArray(m)) setMeals(m);
    } catch (e) {
      console.error('Yemek Ekleme Hata:', e);
      Alert.alert('Hata', 'Yemek eklenemedi.');
    }
  };

  // Yeni: Yanlış eklenen ve reçetesi olmayan yemeği uzun basarak doğrudan silme fonksiyonu
  const handleDeleteMealDirectly = (mealId, mealName) => {
    Alert.alert(
      "Yemeği Sil",
      `"${mealName}" yemek adını listeden tamamen silmek istiyor musunuz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, Sil",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDbConnection();
              if (!db) return;
              
              const validId = safeNum(mealId);
              if (validId > 0) {
                await db.runAsync(`DELETE FROM lu_meals WHERE id = ${validId}`);
                
                const m = await getSafeQuery('SELECT * FROM lu_meals ORDER BY meal_name ASC');
                if (m && Array.isArray(m)) setMeals(m);
                
                if (selectedMealId === validId) setSelectedMealId('');
                Alert.alert('Başarılı', 'Yemek adı listeden silindi.');
              }
            } catch (e) {
              console.log('Yemek silme hatası:', e);
              Alert.alert('Hata', 'Silinemedi: ' + e.message);
            }
          }
        }
      ]
    );
  };

  const handleAddIngredient = async () => {
    const trimmedName = String(newIngName || '').trim();

    if (!trimmedName) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir malzeme adı girin!');
      return;
    }

    try {
      const safeName = trimmedName.replace(/'/g, "''");

      const existingIng = await getSafeQuery(
        'SELECT id FROM lu_ingredients WHERE LOWER(ingredient_name) = LOWER(?)',
        [safeName]
      );

      let newIdNum = 0;
      let isAlreadyExists = false;

      if (existingIng && existingIng.length > 0 && existingIng[0].id) {
        newIdNum = safeNum(existingIng[0].id);
        isAlreadyExists = true;
      } else {
        const res = await runSafeQuery('INSERT INTO lu_ingredients (ingredient_name) VALUES (?)', [safeName]);
        const insertedId = res?.lastInsertRowId ?? res?.insertId;
        newIdNum = safeNum(insertedId);
      }

      setNewIngName('');
      setShowAddIngModal(false);

      const i = await getSafeQuery('SELECT * FROM lu_ingredients ORDER BY ingredient_name ASC');
      if (i && Array.isArray(i)) setIngredients(i);

      if (isAlreadyExists) {
        Alert.alert('Zaten Kayıtlı', `"${trimmedName}" malzemesi sistemde zaten kayıtlı!`);
        if (newIdNum > 0) setCurrentIngredientId(newIdNum);
      } else {
        Alert.alert(
          'Malzeme Eklendi',
          `"${trimmedName}" sisteme kaydedildi. Şimdi bu malzemenin maliyetini girmek ister misiniz?`,
          [
            { 
              text: 'Hayır, Tarifte Kal', 
              style: 'cancel',
              onPress: () => {
                if (newIdNum > 0) setCurrentIngredientId(newIdNum);
              }
            },
            { 
              text: 'Evet, Maliyet Gir', 
              onPress: () => {
                if (newIdNum > 0) {
                  navigation.navigate('Cost', { 
                    preselectedIngredientId: newIdNum 
                  });
                }
              } 
            }
          ]
        );
      }
    } catch (e) {
      console.error('Malzeme Ekleme Hata:', e);
      Alert.alert('Hata', 'Malzeme eklenemedi: ' + e.message);
    }
  };

  const selectedUnitObj = units.find(u => u.id === currentUnitId);
  const isCurrentUnitTime = isTimeUnit(selectedUnitObj?.unit_symbol);

  const handleAddRecipeItem = () => {
    const ingIdNum = safeNum(currentIngredientId);
    const unitIdNum = safeNum(currentUnitId);
    
    const ingObj = ingredients.find(i => i.id === ingIdNum);
    const unitObj = units.find(u => u.id === unitIdNum);
    const unitSymbol = unitObj ? unitObj.unit_symbol : 'birim';

    let qtyNum = 0;
    if (isCurrentUnitTime) {
      qtyNum = safeNum(cookingTime, true);
      if (qtyNum === 0) {
        Alert.alert('Eksik Bilgi', 'Lütfen süre bazlı malzeme için yukarıdan Pişirme Süresi girin!');
        return;
      }
    } else {
      qtyNum = safeNum(currentQty, true);
    }

    if (ingIdNum === 0 || unitIdNum === 0 || qtyNum === 0) {
      Alert.alert('Eksik Seçim', 'Lütfen malzeme, miktar ve ölçü birimini doğru seçin!');
      return;
    }

    const newItem = {
      id: Date.now(),
      ingredient_id: ingIdNum,
      ingredient_name: ingObj ? ingObj.ingredient_name : 'Malzeme',
      quantity: qtyNum,
      unit_id: unitIdNum,
      unit_symbol: unitSymbol
    };

    setRecipeItems(prev => [...prev, newItem]);
    setCurrentQty('');
  };

  const handleRemoveRecipeItem = (itemId) => {
    setRecipeItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSaveOrUpdateRecipe = async () => {
    const mealIdNum = safeNum(selectedMealId);
    if (mealIdNum === 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen tarif için geçerli bir yemek seçin!');
      return;
    }
    if (!selectedPortionUnitId) {
      Alert.alert('Eksik Bilgi', 'Lütfen porsiyon / reçete ölçü birimini seçin!');
      return;
    }
    if (!Array.isArray(recipeItems) || recipeItems.length === 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen reçeteye en az 1 malzeme ekleyin!');
      return;
    }

    const portionUnitIdNum = safeNum(selectedPortionUnitId);
    const portionQtyNum = safeNum(portionQty, true) || 1;
    const salePriceNum = safeNum(salePrice, true);
    const cookingTimeNum = cookingTime ? safeNum(cookingTime, true) : 0;
    const finalCostNum = safeNum(calculatedCost, true);
    const currentEditingId = editingRecipeId ? safeNum(editingRecipeId) : 0;

    if (salePriceNum <= finalCostNum) {
      Alert.alert(
        '⚠️ Düşük Fiyat / Zarar Uyarısı',
        `Girdiğiniz satış fiyatı (${salePriceNum.toFixed(2)} TL), toplam reçete maliyetine (${finalCostNum.toFixed(2)} TL) eşit veya altında! Zararına satış yapıyorsunuz. Yine de devam etmek istiyor musunuz?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Devam Et', onPress: () => executeSaveRecipe(mealIdNum, portionQtyNum, portionUnitIdNum, salePriceNum, cookingTimeNum, finalCostNum, currentEditingId) }
        ]
      );
      return;
    }

    await executeSaveRecipe(mealIdNum, portionQtyNum, portionUnitIdNum, salePriceNum, cookingTimeNum, finalCostNum, currentEditingId);
  };

  const executeSaveRecipe = async (mealIdNum, portionQtyNum, portionUnitIdNum, salePriceNum, cookingTimeNum, finalCostNum, currentEditingId) => {
    try {
      let targetRecipeId = currentEditingId > 0 ? currentEditingId : null;

      if (!targetRecipeId) {
        const existingMeals = await getSafeQuery('SELECT id FROM recipes WHERE meal_id = ?', [mealIdNum]);
        if (Array.isArray(existingMeals) && existingMeals.length > 0 && existingMeals[0]?.id) {
          targetRecipeId = safeNum(existingMeals[0].id);
        }
      }

      if (targetRecipeId && targetRecipeId > 0) {
        await runSafeQuery(
          'UPDATE recipes SET portion_quantity = ?, portion_unit_id = ?, sale_price = ?, cooking_time = ?, calculated_cost = ? WHERE id = ?',
          [portionQtyNum, portionUnitIdNum, salePriceNum, cookingTimeNum, finalCostNum, targetRecipeId]
        );
        await runSafeQuery('DELETE FROM recipe_items WHERE recipe_id = ?', [targetRecipeId]);
      } else {
        const res = await runSafeQuery(
          'INSERT INTO recipes (meal_id, portion_quantity, portion_unit_id, sale_price, cooking_time, calculated_cost) VALUES (?, ?, ?, ?, ?, ?)',
          [mealIdNum, portionQtyNum, portionUnitIdNum, salePriceNum, cookingTimeNum, finalCostNum]
        );
        const insertedId = res?.lastInsertRowId ?? res?.insertId;
        targetRecipeId = safeNum(insertedId);
      }

      if (targetRecipeId > 0 && Array.isArray(recipeItems)) {
        for (const item of recipeItems) {
          const itemIngId = safeNum(item.ingredient_id);
          const itemQty = safeNum(item.quantity, true);
          const itemUnitId = safeNum(item.unit_id);

          if (itemIngId > 0 && itemQty > 0 && itemUnitId > 0) {
            await runSafeQuery(
              'INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit_id) VALUES (?, ?, ?, ?)',
              [targetRecipeId, itemIngId, itemQty, itemUnitId]
            );
          }
        }
      }

      Alert.alert('Başarılı', currentEditingId > 0 ? 'Tarif başarıyla güncellendi!' : 'Tarif başarıyla kaydedildi!');
      await fetchRecipes();
      resetForm();
    } catch (e) {
      console.error('Tarif kaydetme hatası detay:', e);
      Alert.alert('Hata', 'Tarif veritabanına yazılamadı: ' + e.message);
    }
  };

  const handleShowRecipeDetails = (recipe) => {
    setSelectedRecipeDetail(recipe);
    setShowDetailModal(true);
  };

  const handleEditRecipe = (recipe) => {
    setEditingRecipeId(recipe.id);
    setSelectedMealId(recipe.meal_id);
    setPortionQty(recipe.portion_quantity ? recipe.portion_quantity.toString() : '1');
    setSelectedPortionUnitId(recipe.portion_unit_id);
    setSalePrice(recipe.sale_price ? recipe.sale_price.toString() : '');
    setCookingTime(recipe.cooking_time ? recipe.cooking_time.toString() : '');
    
    const formattedItems = (recipe.items || []).map((item, index) => ({
      ...item,
      id: item.id || (Date.now() + index)
    }));

    setRecipeItems(formattedItems);

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleDeleteRecipe = async (recipeId) => {
    try {
      const validId = safeNum(recipeId);
      if (validId > 0) {
        await runSafeQuery(`DELETE FROM recipes WHERE id = ${validId}`);
        await fetchRecipes();
      }
    } catch (e) {
      console.log('Silme hatası:', e);
    }
  };

  const resetForm = () => {
    setEditingRecipeId(null);
    setSelectedMealId('');
    setPortionQty('1');
    setSelectedPortionUnitId('');
    setSalePrice('');
    setCookingTime('');
    setRecipeItems([]);
    setCalculatedCost(0);
  };

  const existingRecipeMealIds = recipeList.map(r => r.meal_id);
  const costIngredientIds = costs.map(c => c.ingredient_id);

  const availableMeals = meals.filter(m => {
    const hasRecipe = existingRecipeMealIds.includes(m.id);
    const isBeingEdited = editingRecipeId !== null && selectedMealId === m.id;
    return !hasRecipe || isBeingEdited;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollViewRef} style={styles.padding} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.headerTitle}>{editingRecipeId ? 'Tarifi Düzenle' : 'Yeni Tarif Oluşturma Ekranı'}</Text>

        <TouchableOpacity 
          style={styles.topBackButton} 
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.topBackButtonText}>← Ana Ekrana Dön</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={styles.label}>Tarife Konu Yemek (Silmek için üzerine uzun basın)</Text>
          <TouchableOpacity onPress={() => setShowAddMealModal(true)} style={styles.actionLinkBtn}>
            <Text style={styles.addText}>+ Yeni Yemek Ekle</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.chipWrapContainer}>
          {availableMeals.length === 0 ? (
            <Text style={{ fontStyle: 'italic', color: '#888', marginVertical: 5 }}>Tarifi girilmemiş yeni yemek bulunmuyor.</Text>
          ) : (
            availableMeals.map((m) => {
              const isSelected = selectedMealId === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.chip, isSelected && styles.selectedChip]}
                  onPress={() => setSelectedMealId(m.id)}
                  onLongPress={() => handleDeleteMealDirectly(m.id, m.meal_name)}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {m.meal_name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <Text style={styles.label}>Porsiyon / Reçete Ölçü Birimi Seç</Text>
        <View style={styles.chipWrapContainer}>
          {units.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.chipSmall, selectedPortionUnitId === u.id && styles.selectedChip]}
              onPress={() => setSelectedPortionUnitId(u.id)}
            >
              <Text style={[styles.chipText, selectedPortionUnitId === u.id && styles.selectedChipText]}>{u.unit_symbol}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Reçete Miktarı</Text>
        <TextInput style={styles.input} placeholder="Örn: 1" keyboardType="numeric" value={portionQty} onChangeText={setPortionQty} />

        <Text style={styles.label}>Satış Fiyatı (TL)</Text>
        <TextInput style={styles.input} placeholder="Örn: 150" keyboardType="numeric" value={salePrice} onChangeText={setSalePrice} />

        <View style={styles.headerContainer}>
          <Text style={styles.sectionTitle}>Reçete Malzemeleri (Sadece Maliyeti Girilenler)</Text>
          <TouchableOpacity onPress={() => setShowAddIngModal(true)} style={styles.actionLinkBtn}>
            <Text style={styles.addText}>+ Yeni Malzeme Ekle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipWrapContainer}>
          {ingredients.map((ing) => {
            const hasCost = costIngredientIds.includes(ing.id);
            const isSelected = currentIngredientId === ing.id;

            return (
              <TouchableOpacity
                key={ing.id}
                style={[
                  styles.chip,
                  isSelected && styles.selectedChip,
                  !hasCost && styles.disabledChipStyle
                ]}
                disabled={!hasCost}
                onPress={() => setCurrentIngredientId(ing.id)}
              >
                <Text style={[
                  styles.chipText,
                  isSelected && styles.selectedChipText,
                  !hasCost && styles.disabledChipText
                ]}>
                  {ing.ingredient_name}{!hasCost ? ' (Maliyeti Yok)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Malzeme Ölçü Birimi</Text>
        <View style={styles.chipWrapContainer}>
          {units.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.chipSmall, currentUnitId === u.id && styles.selectedChip]}
              onPress={() => setCurrentUnitId(u.id)}
            >
              <Text style={[styles.chipText, currentUnitId === u.id && styles.selectedChipText]}>{u.unit_symbol}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, !isCurrentUnitTime && { color: '#AAA' }]}>
          Pişirme Süresi (Dakika) {isCurrentUnitTime ? '(Aktif)' : '(Bu malzeme için gerekmez)'}
        </Text>
        <TextInput 
          style={[styles.input, !isCurrentUnitTime && styles.disabledInput]} 
          placeholder={isCurrentUnitTime ? "Örn: 45" : "Süre bazlı birim seçilmedi"} 
          keyboardType="numeric" 
          editable={isCurrentUnitTime}
          value={isCurrentUnitTime ? cookingTime : ''} 
          onChangeText={setCookingTime} 
        />

        <View style={styles.row}>
          <TextInput 
            style={[styles.input, { flex: 1, marginRight: 10 }, isCurrentUnitTime && styles.disabledInput]} 
            placeholder={isCurrentUnitTime ? "Süre yukarıdaki alandan alınır" : "Miktar"} 
            keyboardType="numeric" 
            editable={!isCurrentUnitTime}
            value={isCurrentUnitTime ? (cookingTime ? `${cookingTime} dk (Otomatik)` : 'Süre bekleniyor...') : currentQty} 
            onChangeText={setCurrentQty} 
          />
          <TouchableOpacity style={styles.addIngredientBtn} onPress={handleAddRecipeItem}>
            <Text style={styles.addBtnText}>+ Reçeteye Ekle</Text>
          </TouchableOpacity>
        </View>

        {recipeItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={[styles.itemText, { flex: 1 }]}>{item.ingredient_name} - {item.quantity} {item.unit_symbol}</Text>
            <TouchableOpacity style={styles.removeItemBtn} onPress={() => handleRemoveRecipeItem(item.id)}>
              <Text style={styles.removeItemText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.costBox}>
          <Text style={styles.costBoxTitle}>Birim Reçete Maliyeti ({portionQty || 1} İçin)</Text>
          <Text style={styles.costBoxAmount}>{calculatedCost.toFixed(2)} TL</Text>
        </View>

        <TouchableOpacity style={[styles.saveButton, editingRecipeId && styles.updateButton]} onPress={handleSaveOrUpdateRecipe}>
          <Text style={styles.saveButtonText}>{editingRecipeId ? 'Tarifi Güncelle' : 'Tarifi Kaydet'}</Text>
        </TouchableOpacity>
        {editingRecipeId !== null ? (
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>Vazgeç</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Kayıtlı Tarifler</Text>
        <View style={{ marginBottom: 40 }}>
          {recipeList.length === 0 ? (
            <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 15 }}>Henüz kayıtlı tarif bulunmuyor.</Text>
          ) : (
            recipeList.map((recipe) => (
              <View key={recipe.id} style={styles.recipeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeCardTitle}>{recipe.meal_name || 'İsimsiz Yemek'}</Text>
                  <Text style={styles.recipeCardDetail}>
                    Reçete: {recipe.portion_quantity || 1} {recipe.portion_unit_symbol || ''} = <Text style={styles.bold}>{(recipe.calculated_cost ? recipe.calculated_cost.toFixed(2) : '0.00')} TL</Text>
                    {recipe.sale_price ? ' | Satış: ' + recipe.sale_price + ' TL' : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={styles.showBtn} onPress={() => handleShowRecipeDetails(recipe)}>
                    <Text style={styles.btnText}>Göster</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEditRecipe(recipe)}>
                    <Text style={styles.btnText}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteRecipe(recipe.id)}>
                    <Text style={styles.btnText}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showDetailModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedRecipeDetail !== null ? (
              <>
                <Text style={styles.modalTitle}>{selectedRecipeDetail.meal_name} - Reçete İçeriği</Text>
                <Text style={styles.detailSubTitle}>Reçete Ölçüsü: {selectedRecipeDetail.portion_quantity} {selectedRecipeDetail.portion_unit_symbol}</Text>
                {selectedRecipeDetail.sale_price != null && selectedRecipeDetail.sale_price !== '' ? (
                  <Text style={styles.detailSubTitle}>Satış Fiyatı: {selectedRecipeDetail.sale_price} TL</Text>
                ) : null}
                {selectedRecipeDetail.cooking_time != null && selectedRecipeDetail.cooking_time !== '' && selectedRecipeDetail.cooking_time !== 0 ? (
                  <Text style={styles.detailSubTitle}>Pişirme Süresi: {selectedRecipeDetail.cooking_time} Dakika</Text>
                ) : null}

                <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Kullanılan Malzemeler:</Text>
                <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
                  {selectedRecipeDetail.items && selectedRecipeDetail.items.length > 0 ? (
                    selectedRecipeDetail.items.map((item, idx) => (
                    <View key={item.ingredient_id ? String(item.ingredient_id) : idx} style={styles.detailItemRow}>
                      <Text style={styles.detailItemText}>
                        • {item.ingredient_name}: <Text style={{ fontWeight: 'bold' }}>{item.quantity} {item.unit_symbol}</Text>
                      </Text>
                    </View>
                  ))
                  ) : (
                    <Text style={{ fontStyle: 'italic', color: '#888' }}>Bu reçeteye tanımlı malzeme bulunamadı.</Text>
                  )}
                </ScrollView>

                <View style={styles.detailCostBox}>
                  <Text style={{ fontWeight: 'bold', color: '#2E7D32' }}>Toplam Reçete Maliyeti: {(selectedRecipeDetail.calculated_cost ? selectedRecipeDetail.calculated_cost.toFixed(2) : '0.00')} TL</Text>
                </View>

                <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowDetailModal(false)}>
                  <Text style={styles.saveButtonText}>Kapat</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

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

      <Modal visible={showAddIngModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Malzeme Ekle</Text>
            <TextInput style={styles.input} placeholder="Malzeme Adı" value={newIngName} onChangeText={setNewIngName} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddIngredient}><Text style={styles.saveButtonText}>Ekle</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddIngModal(false)}><Text style={styles.cancelButtonText}>İptal</Text></TouchableOpacity>
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
  topBackButton: { backgroundColor: '#EEE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignSelf: 'flex-start', marginBottom: 10 },
  topBackButtonText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  headerContainer: { marginTop: 10, marginBottom: 5 },
  actionLinkBtn: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  addText: { color: '#38808A', fontWeight: 'bold', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#FFF' },
  disabledInput: { backgroundColor: '#E9ECEF', color: '#6C757D' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  chipWrapContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', marginRight: 8, marginBottom: 8 },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, backgroundColor: '#E0E0E0', marginRight: 5, marginBottom: 8 },
  selectedChip: { backgroundColor: '#38808A' },
  disabledChipStyle: { backgroundColor: '#F1F3F5', opacity: 0.6, borderWidth: 1, borderColor: '#DEE2E6' },
  chipText: { color: '#333', fontWeight: '500' },
  selectedChipText: { color: '#FFF' },
  disabledChipText: { color: '#ADB5BD', textDecorationLine: 'line-through' },
  addIngredientBtn: { backgroundColor: '#38808A', padding: 12, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, color: '#000', marginBottom: 8 },
  itemRow: { backgroundColor: '#F0F4F8', padding: 10, borderRadius: 6, marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemText: { fontWeight: '600', color: '#333' },
  removeItemBtn: { backgroundColor: '#D32F2F', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  removeItemText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  costBox: { backgroundColor: '#E8F5E9', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center', borderWidth: 1, borderColor: '#C8E6C9' },
  costBoxTitle: { color: '#2E7D32', fontWeight: 'bold', fontSize: 14 },
  costBoxAmount: { color: '#1B5E20', fontWeight: 'bold', fontSize: 24, marginTop: 5 },
  saveButton: { backgroundColor: '#38808A', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  updateButton: { backgroundColor: '#2E7D32' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 12, alignItems: 'center', marginTop: 5 },
  cancelButtonText: { color: '#D32F2F', fontWeight: 'bold' },
  recipeCard: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E9ECEF', flexDirection: 'row', alignItems: 'center' },
  recipeCardTitle: { fontWeight: 'bold', fontSize: 15 },
  recipeCardDetail: { color: '#555', marginTop: 4 },
  bold: { color: '#2B7A78', fontWeight: 'bold' },
  showBtn: { backgroundColor: '#2B7A78', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, marginRight: 5 },
  editBtn: { backgroundColor: '#FFA000', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, marginRight: 5 },
  deleteBtn: { backgroundColor: '#D32F2F', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#38808A' },
  detailSubTitle: { fontSize: 13, color: '#555', marginBottom: 3 },
  detailItemRow: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  detailItemText: { fontSize: 14, color: '#333' },
  detailCostBox: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 6, marginTop: 10, alignItems: 'center' },
  closeModalBtn: { backgroundColor: '#38808A', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  modalSaveBtn: { backgroundColor: '#38808A', padding: 12, borderRadius: 8, flex: 1, alignItems: 'center', marginRight: 5 }
});