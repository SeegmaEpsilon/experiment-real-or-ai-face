/* experiment.js
 * Минимальный шаблон jsPsych-эксперимента:
 * - тренировка с обратной связью
 * - 2 блока: 5с и 10с (разные наборы изображений)
 * - рандомизация порядка
 * - нумерация изображений
 * - поле "почему так решил" только если выбран вариант "ИИ"
 * - отправка результатов в Google Sheets через Apps Script Web App (без сервера)
 */

// 1) Вставьте сюда URL Web App (Deploy -> Web app) из Google Apps Script.
const DATA_ENDPOINT = "https://script.google.com/macros/s/AKfycbxRQ0t6gX5DZdq069OPZswTq2OYEMP6gtOcEirggM3Q-uHwdVPzd6EnOfMUvZraaKv4jQ/exec";

// 2) Настройка таймингов просмотра (мс)
const VIEW_MS_5  = 5000;
const VIEW_MS_10 = 10000;

// 3) Списки стимулов. Подставьте свои файлы в ./img/
// class: "real" | "genA" | "genB"
// generator: "real" | "A" | "B"
// face_gender: "M" | "F"  (пол на изображении, для балансировки)
const TRAINING = [
  { id: "T01", url: "img/train_real_01.jpg", class: "real", generator: "real", face_gender: "F" },
  { id: "T02", url: "img/train_genA_01.jpg", class: "genA", generator: "A",    face_gender: "M" },
  { id: "T03", url: "img/train_real_02.jpg", class: "real", generator: "real", face_gender: "M" },
  { id: "T04", url: "img/train_genB_01.jpg", class: "genB", generator: "B",    face_gender: "F" },
];

// Блок 5 секунд (пример-заглушка: замените своими 24+ изображениями)
const STIMULI_5S = [
  { id: "5S_001", url: "img/5s_real_01.jpg", class: "real", generator: "real", face_gender: "M" },
  { id: "5S_002", url: "img/5s_genA_01.jpg", class: "genA", generator: "A",    face_gender: "F" },
];

// Блок 10 секунд (пример-заглушка)
const STIMULI_10S = [
  { id: "10S_001", url: "img/10s_real_01.jpg", class: "real", generator: "real", face_gender: "F" },
  { id: "10S_002", url: "img/10s_genB_01.jpg", class: "genB", generator: "B",    face_gender: "M" },
];

// =============== инфраструктура ===============

const participant_id = (crypto?.randomUUID?.() ?? String(Math.random()).slice(2)) + "-" + Date.now();

function nowIso() { return new Date().toISOString(); }

function postJSON(obj) {
  // Apps Script Web Apps часто упираются в CORS (preflight OPTIONS). Чтобы обойти,
  // отправляем "no-cors" (или sendBeacon) и не читаем ответ.
  const payload = JSON.stringify(obj);

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "text/plain;charset=UTF-8" });
    return navigator.sendBeacon(DATA_ENDPOINT, blob);
  }

  fetch(DATA_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    body: payload,
  }).catch(() => {});

  return true;
}

function mapClassToTarget(cls) {
  // Что "истина" для задачи "реальное vs ИИ"
  return (cls === "real") ? "real" : "ai";
}

// =============== сборка jsPsych ===============

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  on_finish: () => {
    const testData = jsPsych.data.get().filter({ phase: "test", task: "judge" }).values();
    const n = testData.length;
    const correct = testData.filter(r => r.correct === true).length;
    const acc = n ? Math.round((correct / n) * 1000) / 10 : 0;

    document.body.innerHTML = `
      <div class="jspsych-content">
        <h2>Спасибо!</h2>
        <p>Сессия завершена. Ваш общий результат: <b>${acc}%</b> (по тестовой части).</p>
        <p class="small">Можно закрыть вкладку.</p>
      </div>
    `;
  }
});

function updateProgress(done, total) {
  jsPsych.setProgressBar(total ? (done / total) : 0);
}

// Создаёт пару trials: (1) просмотр без ответа, (2) выбор ответа.
function makeImagePair(stim, view_ms, block) {
  const view_trial = {
    type: jsPsychImageKeyboardResponse,
    stimulus: stim.url,
    choices: "NO_KEYS",
    trial_duration: view_ms,
    response_ends_trial: false,
    data: {
      phase: "test",
      task: "view",
      block,
      view_ms,
      image_id: stim.id,
      true_class: stim.class,
      generator: stim.generator,
      face_gender: stim.face_gender,
      participant_id,
      ts: nowIso(),
    },
  };

  const judge_trial = {
    type: jsPsychImageButtonResponse,
    stimulus: stim.url,
    choices: ["Реальное", "ИИ-сгенерировано"],
    prompt: `<div class="img-id">Изображение № <b>${stim.id}</b></div>`,
    data: {
      phase: "test",
      task: "judge",
      block,
      view_ms,
      image_id: stim.id,
      true_class: stim.class,
      generator: stim.generator,
      face_gender: stim.face_gender,
      participant_id,
    },
    on_finish: (data) => {
      // response: 0 -> "Реальное", 1 -> "ИИ-сгенерировано"
      const truth = mapClassToTarget(stim.class);          // "real" | "ai"
      const ans   = (data.response === 0) ? "real" : "ai"; // "real" | "ai"
      data.ts = nowIso();
      data.truth_target = truth;
      data.answer_target = ans;
      data.correct = (truth === ans);

      // Отправка строки в таблицу (можно отправлять только judge, это достаточно).
      postJSON({
        ts: data.ts,
        participant_id,
        block,
        view_ms,
        image_id: stim.id,
        true_class: stim.class,
        generator: stim.generator,
        face_gender: stim.face_gender,
        answer_target: ans,
        truth_target: truth,
        correct: data.correct,
        rt_ms: data.rt,
      });
    },
  };

  // Если выбран "ИИ", спросить причины (список + свободный текст)
  const reasons_multi = {
    type: jsPsychSurveyMultiSelect,
    questions: [{
      prompt: "Почему было решено, что это ИИ? (можно выбрать несколько)",
      options: [
        "Анатомические артефакты (пальцы/зубы/уши)",
        "Артефакты фона/текстур",
        "Неестественный свет/тени",
        "«Пластиковая» кожа / странные поры",
        "Странные украшения/аксессуары/надписи",
        "Искажения волос/контуров",
        "Другое"
      ],
      required: false,
      horizontal: false,
      name: "reasons"
    }],
    data: {
      phase: "test",
      task: "reason_multi",
      block,
      image_id: stim.id,
      participant_id,
    },
    on_finish: (data) => {
      const resp = (data.response && data.response.reasons) ? data.response.reasons : [];
      postJSON({
        ts: nowIso(),
        participant_id,
        block,
        image_id: stim.id,
        reasons: resp.join(";"),
        kind: "reason_multi",
      });
    }
  };

  const reasons_text = {
    type: jsPsychSurveyText,
    questions: [{
      prompt: "Кратко опишите, что именно показалось «неестественным» (опционально)",
      rows: 3,
      columns: 60,
      required: false,
      name: "reason_free"
    }],
    data: {
      phase: "test",
      task: "reason_text",
      block,
      image_id: stim.id,
      participant_id,
    },
    on_finish: (data) => {
      const txt = (data.response && data.response.reason_free) ? String(data.response.reason_free) : "";
      postJSON({
        ts: nowIso(),
        participant_id,
        block,
        image_id: stim.id,
        reason_free: txt,
        kind: "reason_text",
      });
    }
  };

  const reasons_branch = {
    timeline: [reasons_multi, reasons_text],
    conditional_function: () => {
      const last = jsPsych.data.get().last(1).values()[0];
      return last?.task === "judge" && last?.response === 1; // выбран "ИИ-сгенерировано"
    }
  };

  return [view_trial, judge_trial, reasons_branch];
}

// Тренировочный trial с обратной связью (не отправляем на сервер)
function makeTrainingPair(stim) {
  const judge = {
    type: jsPsychImageButtonResponse,
    stimulus: stim.url,
    choices: ["Реальное", "ИИ-сгенерировано"],
    prompt: `<div class="img-id">Тренировка: <b>${stim.id}</b></div>`,
    data: { phase: "train", task: "judge", image_id: stim.id }
  };

  const fb = {
    type: jsPsychHtmlButtonResponse,
    choices: ["Далее"],
    stimulus: () => {
      const last = jsPsych.data.get().last(1).values()[0];
      const truth = mapClassToTarget(stim.class);
      const ans   = (last.response === 0) ? "real" : "ai";
      const ok = (truth === ans);
      return ok
        ? "<p><b>Верно.</b></p>"
        : "<p><b>Неверно.</b> (Тренировочная обратная связь)</p>";
    },
    data: { phase: "train", task: "feedback", image_id: stim.id }
  };

  return [judge, fb];
}

// =============== timeline ===============

const all_images = [
  ...TRAINING.map(x => x.url),
  ...STIMULI_5S.map(x => x.url),
  ...STIMULI_10S.map(x => x.url),
];

const timeline = [];

// Инструкция/согласие
timeline.push({
  type: jsPsychHtmlButtonResponse,
  choices: ["Начать"],
  stimulus: `
    <h2>Эксперимент: различение реальных и ИИ-изображений</h2>
    <p>Вам будут показываться изображения. После просмотра нужно выбрать, является ли изображение реальным или ИИ-сгенерированным.</p>
    <ul>
      <li>Личных данных не требуется (участник идентифицируется случайным кодом).</li>
      <li>Можно прекратить участие в любой момент, закрыв вкладку.</li>
    </ul>
    <p class="small">Нажимая «Начать», участник подтверждает согласие на участие.</p>
  `
});

// Preload (для стабильного тайминга)
timeline.push({
  type: jsPsychPreload,
  images: all_images,
});

// Тренировка
timeline.push({
  type: jsPsychHtmlButtonResponse,
  choices: ["Перейти к тренировке"],
  stimulus: "<h3>Тренировочная часть</h3><p>В тренировке будет обратная связь. В тестовой части обратной связи не будет.</p>"
});

for (const stim of TRAINING) timeline.push(...makeTrainingPair(stim));

timeline.push({
  type: jsPsychHtmlButtonResponse,
  choices: ["Перейти к тесту"],
  stimulus: "<h3>Тестовая часть</h3><p>Сначала блок с 5 секунд просмотра, затем блок с 10 секунд.</p>"
});

// Тест: блок 5s
const block5 = jsPsych.randomization.shuffle(STIMULI_5S.slice());
// Тест: блок 10s
const block10 = jsPsych.randomization.shuffle(STIMULI_10S.slice());

const total_pairs = block5.length + block10.length;
let done_pairs = 0;

timeline.push({
  type: jsPsychHtmlButtonResponse,
  choices: ["Начать блок 5 секунд"],
  stimulus: "<h3>Блок 1</h3><p>Каждое изображение сначала показывается <b>5 секунд</b> без возможности ответа, затем нужно выбрать вариант.</p>"
});

for (const stim of block5) {
  timeline.push(...makeImagePair(stim, VIEW_MS_5, "5s"));
  done_pairs += 1;
  timeline.push({ // обновление прогресса после каждой картинки
    type: jsPsychHtmlButtonResponse,
    choices: ["Продолжить"],
    stimulus: "",
    trial_duration: 10,
    response_ends_trial: false,
    on_start: () => updateProgress(done_pairs, total_pairs),
    data: { phase: "meta", task: "progress" }
  });
}

timeline.push({
  type: jsPsychHtmlButtonResponse,
  choices: ["Начать блок 10 секунд"],
  stimulus: "<h3>Блок 2</h3><p>Каждое изображение сначала показывается <b>10 секунд</b>, затем нужно выбрать вариант.</p>"
});

for (const stim of block10) {
  timeline.push(...makeImagePair(stim, VIEW_MS_10, "10s"));
  done_pairs += 1;
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    choices: ["Продолжить"],
    stimulus: "",
    trial_duration: 10,
    response_ends_trial: false,
    on_start: () => updateProgress(done_pairs, total_pairs),
    data: { phase: "meta", task: "progress" }
  });
}

jsPsych.run(timeline);
