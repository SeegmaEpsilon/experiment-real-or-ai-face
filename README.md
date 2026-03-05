# Шаблон эксперимента (реальные vs ИИ-изображения)

## Быстрый старт
1. Создайте Google Sheet -> Extensions -> Apps Script.
2. Вставьте `apps_script.gs`, укажите `SPREADSHEET_ID`.
3. Deploy -> Web app (Execute as: Me, Access: Anyone) -> получите URL.
4. В `experiment.js` вставьте URL в `DATA_ENDPOINT`.
5. Положите изображения в папку `img/` и обновите массивы TRAINING / STIMULI_5S / STIMULI_10S.
6. Залейте репозиторий на GitHub и включите GitHub Pages (Settings -> Pages).

## Примечания
- Для обхода ограничений CORS Apps Script используется `navigator.sendBeacon` либо `fetch(..., mode: 'no-cors')`.
- В таблицу пишутся строки по каждому выбору (judge) и по блокам причин, когда выбран вариант «ИИ».
