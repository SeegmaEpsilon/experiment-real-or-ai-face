/**
 * Google Apps Script для приёма данных.
 */

const SPREADSHEET_ID = "15ViBcClC3PENsRGVN9d1qp1pEOQZQdy2LKsS4S0ajWg"; 
const SHEET_NAME = "data";

// ЗАГОЛОВКИ (Header)
const HEADERS = [
  "ts",              // Время
  "participant_id",  // ID участника
  "age",             // Возраст
  "gender",          // Пол
  "kind",            // Тип события
  "image_id",        // ID изображения
  "answer",          // Ответ пользователя (real/ai)
  "correct",         // Верно/Неверно
  "rt",              // Время реакции
  "reason",          // Текстовое обоснование из поля ввода
  "include_training" // Была ли тренировка
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); 
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }
    
    // Если лист пустой, добавляем заголовок (Header Row)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    const rawData = e.postData.contents;
    const data = JSON.parse(rawData);

    // Маппинг данных по заголовкам
    const row = HEADERS.map(header => {
      return (data[header] !== undefined) ? data[header] : "";
    });

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({"result":"success"})).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}