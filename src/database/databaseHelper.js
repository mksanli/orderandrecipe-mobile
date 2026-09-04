import { getDbConnection } from './database';

export const safeNum = (val, allowFloat = false) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = allowFloat ? parseFloat(val) : parseInt(val, 10);
  return isNaN(num) ? 0 : num;
};

// Parametreler içindeki undefined değerleri temizleyen yardımcı fonksiyon
const sanitizeParams = (params) => {
  if (!Array.isArray(params)) return [];
  return params.map(p => (p === undefined ? null : p));
};

export const getSafeQuery = async (query, params = []) => {
  try {
    const db = await getDbConnection();
    if (!db) {
      console.error('Veritabanı bağlantısı bulunamadı!');
      return [];
    }
    const cleanParams = sanitizeParams(params);
    const result = await db.getAllAsync(query, cleanParams);
    return result || [];
  } catch (e) {
    console.error('Güvenli sorgu hatası:', e);
    return [];
  }
};

export const runSafeQuery = async (query, params = []) => {
  try {
    const db = await getDbConnection();
    if (!db) {
      console.error('Veritabanı bağlantısı bulunamadı!');
      return null;
    }
    const cleanParams = sanitizeParams(params);
    const result = await db.runAsync(query, cleanParams);
    return result;
  } catch (e) {
    console.error('Güvenli çalıştırma hatası:', e);
    throw e;
  }
};