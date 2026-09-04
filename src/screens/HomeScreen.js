import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Linking, BackHandler, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDbConnection, initDatabase, resetDatabase } from '../database/database';

export default function HomeScreen({ navigation }) {
  const { width: windowWidth } = useWindowDimensions();

  // Dinamik ölçü ve tablet uyumlu değişkenler
  const isTablet = windowWidth > 600;
  const containerMaxWidth = isTablet ? 680 : windowWidth;
  const horizontalPadding = 18;
  const availableWidth = containerMaxWidth - (horizontalPadding * 2);
  const cardWidth = Math.floor((availableWidth - 20) / 3); 
  const fontScale = isTablet ? 1.25 : 1;

  // Stiller memoize edildi
  const styles = useMemo(() => {
    return StyleSheet.create({
      container: { flex: 1, backgroundColor: '#FFF' },
      scrollContainer: { flexGrow: 1, paddingVertical: 10, paddingBottom: 40 },
      contentWrapper: { width: '100%', alignSelf: 'center', paddingHorizontal: horizontalPadding },
      
      // Üst Banner
      headerCard: { 
        width: '100%',
        height: isTablet ? 150 : 128.5,
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        backgroundColor: 'rgba(58, 133, 142, 0.66)', 
        paddingHorizontal: 16, 
        borderRadius: 19, 
        marginBottom: 15
      },
      logoImage: { 
        width: isTablet ? 110 : 93.5, 
        height: isTablet ? 110 : 93.5, 
        resizeMode: 'contain' 
      },
      headerTextContainer: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
      welcomeText: { fontSize: Math.round(19 * fontScale), fontWeight: 'bold', color: '#FFFFFF' },
      dateText: { fontSize: Math.round(13 * fontScale), color: '#FFFFFF', marginTop: 4 },

      // Title
      mainTitle: { fontSize: Math.round(18 * fontScale), fontWeight: 'bold', color: '#3a858e', marginBottom: 12 },

      // Order Notification Box
      alertCard: { 
        width: '100%',
        height: isTablet ? 46 : 37.6,
        backgroundColor: '#c8d1d9', 
        borderRadius: 8, 
        marginBottom: 12, 
        justifyContent: 'center',
        alignItems: 'center' 
      },
      alertText: { fontSize: Math.round(14 * fontScale), color: '#2F4F4F', fontWeight: '500' },
      boldText: { fontWeight: 'bold', color: '#1E3F43' },

      // Search Box
      searchBoxContainer: { 
        width: '100%',
        height: isTablet ? 46 : 37.6,
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: 'rgba(200, 209, 217, 0.66)', 
        borderRadius: 8, 
        paddingHorizontal: 10, 
        marginBottom: 20
      },
      searchIconImage: { 
        width: isTablet ? 26 : 22, 
        height: isTablet ? 26 : 22, 
        marginRight: 8,
        tintColor: '#555' 
      },
      searchInput: { flex: 1, height: '100%', fontSize: Math.round(14 * fontScale), color: '#333', paddingVertical: 0 },
      clearText: { fontSize: Math.round(14 * fontScale), color: '#555', paddingHorizontal: 5 },

      // Üçlü Menü Kutuları Alanı
      menuRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
      menuColumn: { alignItems: 'center', width: cardWidth },
      menuCard: { 
        width: cardWidth,
        height: cardWidth,
        backgroundColor: 'rgba(58, 133, 142, 0.65)', 
        borderRadius: 19, 
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6
      },
      menuImageIcon: { 
        width: Math.round(cardWidth * 0.5), 
        height: Math.round(cardWidth * 0.5) 
      },
      menuLabel: { 
        fontSize: Math.round(12 * fontScale), 
        fontWeight: 'bold', 
        color: '#3a858e', 
        textAlign: 'center' 
      },

      // Bölüm Başlıkları
      sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
      sectionTitle: { fontSize: Math.round(15 * fontScale), fontWeight: 'bold', color: '#3a858e' },
      sectionTitleHizliErisim: { fontSize: Math.round(15 * fontScale), fontWeight: 'bold', color: '#3a858e', marginTop: 15, marginBottom: 12 },
      sectionHeaderIcon: { fontSize: Math.round(16 * fontScale), color: '#3a858e' },

      // Top 3 Müşteri Kartları
      topCustomersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
      topCustomerCard: { 
        width: cardWidth,
        height: cardWidth,
        backgroundColor: '#c8d1d9', 
        padding: 8, 
        borderRadius: 19, 
        alignItems: 'center',
        justifyContent: 'space-between'
      },
      rankBadge: { 
        width: isTablet ? 26 : 20, 
        height: isTablet ? 26 : 20, 
        borderRadius: isTablet ? 13 : 10, 
        backgroundColor: '#3a858e', 
        justifyContent: 'center', 
        alignItems: 'center' 
      },
      rankBadgeText: { fontSize: Math.round(10 * fontScale), fontWeight: 'bold', color: '#FFF' },
      topCustomerName: { fontSize: Math.round(12 * fontScale), fontWeight: 'bold', color: '#333' },
      topCustomerSpent: { fontSize: Math.round(12 * fontScale), fontWeight: 'bold', color: '#2E7D32' },
      topCustomerDate: { fontSize: Math.round(8 * fontScale), color: '#555', textAlign: 'center', lineHeight: Math.round(11 * fontScale) },

      // Hızlı Erişim Kartları
      shortcutsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
      shortcutCard: { 
        width: cardWidth,
        height: Math.round(cardWidth * 0.73),
        backgroundColor: '#c8d1d9', 
        borderRadius: 14, 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 6
      },
      shortcutIcon: { width: Math.round(cardWidth * 0.35), height: Math.round(cardWidth * 0.35), marginBottom: 4 },
      shortcutText: { fontSize: Math.round(10 * fontScale), fontWeight: 'bold', color: '#333', textAlign: 'center' },

      // Alt Butonlar
      bottomButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, marginBottom: 30 },
      exitButton: { 
        flex: 1, 
        backgroundColor: '#D32F2F', 
        padding: 12, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginRight: 6 
      },
      resetButton: { 
        flex: 1, 
        backgroundColor: '#FF5722', 
        padding: 12, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginLeft: 6 
      },
      bottomButtonText: { color: '#FFF', fontSize: Math.round(13 * fontScale), fontWeight: 'bold' },

      // Arama Sonuçları Stilleri
      resultsContainer: { marginTop: 5 },
      resultsHeader: { fontSize: Math.round(15 * fontScale), fontWeight: 'bold', color: '#3a858e', marginBottom: 12 },
      emptyText: { fontStyle: 'italic', color: '#888', marginVertical: 10, textAlign: 'center', fontSize: Math.round(13 * fontScale) },
      categoryTitle: { fontSize: Math.round(14 * fontScale), fontWeight: 'bold', color: '#333', marginTop: 8, marginBottom: 6 },
      resultCard: { backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#E9ECEF' },
      resultTitle: { fontSize: Math.round(14 * fontScale), fontWeight: 'bold', color: '#2B7A78' },
      resultSub: { fontSize: Math.round(12 * fontScale), color: '#555', marginTop: 2 }
    });
  }, [windowWidth, cardWidth, isTablet, fontScale]);

  const [pendingCount, setPendingCount] = useState(0);
  const [topCustomers, setTopCustomers] = useState([]);
  
  // Tarihi dinamik olarak bugünün tarihine ayarlıyoruz
  const [currentDate, setCurrentDate] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    ingredients: [],
    meals: [],
    recipes: [],
    orders: []
  });

  useEffect(() => {
    initDatabase();

    // Anlık tarihi Türkçe formatta oluşturuyoruz (Örn: 2 Eylül 2026)
    const today = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    setCurrentDate(today.toLocaleDateString('tr-TR', options));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadDashboardData(active);
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
      return () => { active = false; };
    }, [searchQuery])
  );

  const handleResetApp = () => {
    Alert.alert(
      "Verileri Sıfırla",
      "Tüm test verileri (siparişler, reçeteler, malzemeler ve maliyetler) kalıcı olarak silinecek. Emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Evet, Sıfırla", 
          style: "destructive",
          onPress: async () => {
            const success = await resetDatabase();
            if (success) {
              Alert.alert("Başarılı", "Uygulama verileri sıfırlandı. Ana ekran yenileniyor.");
              loadDashboardData(true);
            } else {
              Alert.alert("Hata", "Sıfırlama sırasında bir sorun oluştu.");
            }
          }
        }
      ]
    );
  };

  const loadDashboardData = async (isMounted = true) => {
    try {
      const db = await getDbConnection();
      if (!db) return;

      const res = await db.getFirstAsync("SELECT COUNT(*) as count FROM orders WHERE LOWER(COALESCE(status, 'pending')) = 'pending'");
      
      const ordersList = await db.getAllAsync(`
        SELECT o.id, o.customer_name, o.delivery_datetime, o.status,
               oi.quantity, r.sale_price, r.portion_quantity, u.unit_symbol as order_unit_symbol,
               ru.unit_symbol as portion_unit_symbol
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN recipes r ON oi.meal_id = r.meal_id
        LEFT JOIN lu_units u ON oi.unit_id = u.id
        LEFT JOIN lu_units ru ON r.portion_unit_id = ru.id
        WHERE LOWER(COALESCE(o.status, 'pending')) != 'canceled'
      `);

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

      const orderTotalsMap = {};

      (ordersList || []).forEach(row => {
        if (!row.id || !row.customer_name) return;

        if (!orderTotalsMap[row.id]) {
          orderTotalsMap[row.id] = {
            customer_name: row.customer_name,
            delivery_datetime: row.delivery_datetime || '',
            order_total_sale: 0
          };
        }

        const qty = row.quantity || 0;
        const sale = row.sale_price || 0;
        const portion = row.portion_quantity || 1;
        const factor = getFactor(row.portion_unit_symbol, row.order_unit_symbol);

        if (portion > 0) {
          orderTotalsMap[row.id].order_total_sale += (qty * factor / portion) * sale;
        }
      });

      const customerMap = {};

      Object.values(orderTotalsMap).forEach(ord => {
        const name = ord.customer_name;
        if (!customerMap[name]) {
          customerMap[name] = {
            customer_name: name,
            total_spent: 0,
            last_order_date: ord.delivery_datetime
          };
        }

        customerMap[name].total_spent += ord.order_total_sale;

        if (ord.delivery_datetime && ord.delivery_datetime > customerMap[name].last_order_date) {
          customerMap[name].last_order_date = ord.delivery_datetime;
        }
      });

      const formattedCustomers = Object.values(customerMap)
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 3)
        .map(c => ({
          ...c,
          total_spent: Math.round(c.total_spent * 100) / 100,
          last_order_date: c.last_order_date ? c.last_order_date.split(' ')[0] : '20-07-2026'
        }));

      if (isMounted) {
        setPendingCount(res && res.count ? res.count : 0);
        setTopCustomers(formattedCustomers);
      }
    } catch (e) {
      console.log('Dashboard veri yükleme hatası:', e);
    }
  };

  // Evrensel Arama Fonksiyonu (Malzemeler, Yemekler, Reçeteler ve Siparişler / Notlar / Ambalajlar)
  const handleSearch = async (text) => {
    setSearchQuery(text);
    const rawSearch = text ? String(text).trim() : '';

    if (!rawSearch) {
      setSearchResults({ ingredients: [], meals: [], recipes: [], orders: [] });
      return;
    }

    try {
      const db = await getDbConnection();
      if (!db) return;

      const safeSearch = rawSearch.replace(/'/g, "''");

      // 1. Malzemeler ve Ambalajlar
      const ingResults = await db.getAllAsync(
        `SELECT id, ingredient_name, is_packaging FROM lu_ingredients WHERE LOWER(ingredient_name) LIKE LOWER('%${safeSearch}%') LIMIT 10`
      );

      // 2. Yemekler
      const mealResults = await db.getAllAsync(
        `SELECT id, meal_name FROM lu_meals WHERE LOWER(meal_name) LIKE LOWER('%${safeSearch}%') LIMIT 10`
      );

      // 3. Tarifler
      const recipeResults = await db.getAllAsync(
        `SELECT r.id, m.meal_name, r.calculated_cost, r.portion_quantity, u.unit_symbol 
         FROM recipes r 
         LEFT JOIN lu_meals m ON r.meal_id = m.id 
         LEFT JOIN lu_units u ON r.portion_unit_id = u.id
         WHERE LOWER(m.meal_name) LIKE LOWER('%${safeSearch}%') LIMIT 10`
      );

      // 4. Siparişler (Müşteri adı, notlar, sipariş edilen yemekler veya ambalajlar eşleşiyorsa)
      const orderResults = await db.getAllAsync(`
        SELECT DISTINCT o.id, o.customer_name, o.delivery_datetime, o.status, o.notes
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN lu_meals m ON oi.meal_id = m.id
        LEFT JOIN order_packagings op ON o.id = op.order_id
        LEFT JOIN lu_ingredients i ON op.ingredient_id = i.id
        WHERE LOWER(o.customer_name) LIKE LOWER('%${safeSearch}%') 
           OR LOWER(COALESCE(o.notes, '')) LIKE LOWER('%${safeSearch}%')
           OR LOWER(COALESCE(m.meal_name, '')) LIKE LOWER('%${safeSearch}%')
           OR LOWER(COALESCE(i.ingredient_name, '')) LIKE LOWER('%${safeSearch}%')
        LIMIT 10
      `);

      setSearchResults({
        ingredients: ingResults || [],
        meals: mealResults || [],
        recipes: recipeResults || [],
        orders: orderResults || []
      });
    } catch (e) {
      console.log('Arama hatası:', e);
      setSearchResults({ ingredients: [], meals: [], recipes: [], orders: [] });
    }
  };

  const openExternalUrl = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Bağlantı hatası:', error);
    }
  };

  const handleExitApp = () => {
    Alert.alert("Uygulamadan Çık", "Uygulamayı kapatmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Kapat", onPress: () => BackHandler.exitApp() }
    ]);
  };

  const ingList = searchResults?.ingredients || [];
  const mealList = searchResults?.meals || [];
  const recList = searchResults?.recipes || [];
  const ordList = searchResults?.orders || [];
  const hasResults = ingList.length > 0 || mealList.length > 0 || recList.length > 0 || ordList.length > 0;

  // Top 3 Müşteri listesini her zaman 3 slotlu tam bir gride sabitleyelim
  const customerSlots = [0, 1, 2].map(i => topCustomers[i] || null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.contentWrapper}>
          
          {/* Üst Banner */}
          <View style={styles.headerCard}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.welcomeText}>Hoş geldin Türkün!</Text>
              <Text style={styles.dateText}>{currentDate}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.mainTitle}>Yemek Sipariş ve Maliyet Paneli</Text>

          {/* Order Notification Box */}
          <View style={styles.alertCard}>
            <Text style={styles.alertText}>
              <Text style={styles.boldText}>{pendingCount}</Text> adet bekleyen siparişiniz var
            </Text>
          </View>

          {/* Search Box */}
          <View style={styles.searchBoxContainer}>
            <Image source={require('../../assets/magnifyer.png')} style={styles.searchIconImage} resizeMode="contain" />
            <TextInput
              style={styles.searchInput}
              placeholder="Malzeme, yemek, tarif veya müşteri ara..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Text style={styles.clearText}>✖</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {searchQuery.trim() !== '' ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeader}>Arama Sonuçları ({searchQuery})</Text>

              {!hasResults ? (
                <Text style={styles.emptyText}>Eşleşen kayıt bulunamadı.</Text>
              ) : (
                <>
                  {ingList.length > 0 ? (
                    <>
                      <Text style={styles.categoryTitle}>💰 Malzemeler ve Ambalajlar ({ingList.length})</Text>
                      {ingList.map((item) => (
                        <View key={`ing-${item.id}`} style={styles.resultCard}>
                          <Text style={styles.resultTitle}>
                            {item.ingredient_name} {item.is_packaging === 1 ? '📦 (Ambalaj)' : ''}
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  {mealList.length > 0 ? (
                    <>
                      <Text style={styles.categoryTitle}>🍽️ Yemekler ({mealList.length})</Text>
                      {mealList.map((item) => (
                        <View key={`meal-${item.id}`} style={styles.resultCard}>
                          <Text style={styles.resultTitle}>{item.meal_name}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  {recList.length > 0 ? (
                    <>
                      <Text style={styles.categoryTitle}>📋 Yemek Reçeteleri ({recList.length})</Text>
                      {recList.map((item) => (
                        <View key={`rec-${item.id}`} style={styles.resultCard}>
                          <Text style={styles.resultTitle}>{item.meal_name}</Text>
                          <Text style={styles.resultSub}>
                            Reçete: {item.portion_quantity || 1} {item.unit_symbol || 'birim'} = {item.calculated_cost ? item.calculated_cost.toFixed(2) : '0.00'} TL
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  {ordList.length > 0 ? (
                    <>
                      <Text style={styles.categoryTitle}>🍲 Siparişler ({ordList.length})</Text>
                      {ordList.map((item) => (
                        <View key={`ord-${item.id}`} style={styles.resultCard}>
                          <Text style={styles.resultTitle}>
                            {item.customer_name} ({item.status === 'pending' ? 'Hazırlanıyor' : item.status === 'completed' ? 'Teslim Edildi' : 'İptal'})
                          </Text>
                          <Text style={styles.resultSub}>Teslim: {item.delivery_datetime}</Text>
                          {item.notes ? <Text style={styles.resultSub}>Not: {item.notes}</Text> : null}
                        </View>
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </View>
          ) : (
            <>
              {/* Üçlü Menü Kutuları */}
              <View style={styles.menuRow}>
                
                {/* Cost Button */}
                <View style={styles.menuColumn}>
                  <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Cost')}>
                    <Image source={require('../../assets/cost.png')} style={styles.menuImageIcon} resizeMode="contain" />
                  </TouchableOpacity>
                  <Text style={styles.menuLabel}>Maliyet Yönetimi</Text>
                </View>

                {/* Recipe Button */}
                <View style={styles.menuColumn}>
                  <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Recipe')}>
                    <Image source={require('../../assets/recipe.png')} style={styles.menuImageIcon} resizeMode="contain" />
                  </TouchableOpacity>
                  <Text style={styles.menuLabel}>Tarif Oluşturma</Text>
                </View>

                {/* Order Button */}
                <View style={styles.menuColumn}>
                  <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('Order')}>
                    <Image source={require('../../assets/order.png')} style={styles.menuImageIcon} resizeMode="contain" />
                  </TouchableOpacity>
                  <Text style={styles.menuLabel}>Sipariş</Text>
                </View>

              </View>

              {/* Top 3 Müşteri Başlığı */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Top 3 Müşteri</Text>
                <Text style={styles.sectionHeaderIcon}>👥</Text>
              </View>

              {/* Top 3 Müşteri Kartları */}
              <View style={styles.topCustomersRow}>
                {customerSlots.map((c, idx) => {
                  if (!c) {
                    return <View key={`empty-${idx}`} style={{ width: cardWidth }} />;
                  }
                  return (
                    <View 
                      key={idx} 
                      style={[styles.topCustomerCard, { width: cardWidth }]}
                    >
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.topCustomerName} numberOfLines={1}>{c.customer_name}</Text>
                      <Text style={styles.topCustomerSpent}>{c.total_spent.toFixed(2)} TL</Text>
                      <Text style={styles.topCustomerDate}>Son Sipariş Tarihi{'\n'}{c.last_order_date}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Hızlı Erişim Başlığı */}
              <Text style={styles.sectionTitleHizliErisim}>Hızlı Erişim</Text>
              <View style={styles.shortcutsContainer}>
                <TouchableOpacity style={styles.shortcutCard} onPress={() => openExternalUrl('https://www.migros.com.tr/')}>
                  <Image source={require('../../assets/migros.png')} style={styles.shortcutIcon} resizeMode="contain" />
                  <Text style={styles.shortcutText}>Migros Market</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortcutCard} onPress={() => openExternalUrl('https://www.nefisyemektarifleri.com/')}>
                  <Image source={require('../../assets/nefis.png')} style={styles.shortcutIcon} resizeMode="contain" />
                  <Text style={styles.shortcutText}>Nefis Tarifler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortcutCard} onPress={() => openExternalUrl('https://www.instagram.com/hayalurunleridukkan/')}>
                  <Image source={require('../../assets/instagram.png')} style={styles.shortcutIcon} resizeMode="contain" />
                  <Text style={styles.shortcutText}>Instagram</Text>
                </TouchableOpacity>
              </View>

              {/* Alt Butonlar */}
              <View style={styles.bottomButtonsRow}>
                <TouchableOpacity style={styles.exitButton} onPress={handleExitApp}>
                  <Text style={styles.bottomButtonText}>Uygulamadan Çık</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.resetButton} onPress={handleResetApp}>
                  <Text style={styles.bottomButtonText}>Tüm Verileri Sıfırla</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}