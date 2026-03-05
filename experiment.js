/* experiment.js */

const DATA_ENDPOINT = "https://script.google.com/macros/s/AKfycbxRQ0t6gX5DZdq069OPZswTq2OYEMP6gtOcEirggM3Q-uHwdVPzd6EnOfMUvZraaKv4jQ/exec";

// --- Глобальные переменные данных участника ---
let participant_age = "";
let participant_gender = "";
const participant_id = (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)) + "-" + Date.now();

function nowIso() { return new Date().toISOString(); }

// --- Настройки стимулов ---
const N_PER_GROUP = 10;
let include_training = false; 
let progress_done = 0;

function makeSeq(dir, idPrefix, cls, gen, gender, n = N_PER_GROUP) {
  return Array.from({ length: n }, (_, i) => {
    const nn = String(i + 1).padStart(2, "0");
    return {
      id: `${idPrefix}${nn}`,
      url: `${dir}/${nn}.jpg`,
      class: cls,
      generator: gen,
      face_gender: gender,
    };
  });
}

function shuffle(arr) {
  return arr.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}

// Формируем наборы
const rM = shuffle(makeSeq("img/real/man",   "RM_", "real", "real", "M"));
const rF = shuffle(makeSeq("img/real/woman", "RW_", "real", "real", "F"));
const fM = shuffle(makeSeq("img/fake/man",   "FM_", "fake", "A",    "M"));
const fF = shuffle(makeSeq("img/fake/woman", "FW_", "fake", "A",    "F"));

// Тренировка (первые элементы из каждого набора)
const TRAINING_STIMULI = [rM[0], rF[0], fM[0], fF[0]];

// Тестовые стимулы (все остальные)
const TEST_STIMULI = shuffle([
  ...rM.slice(1), ...rF.slice(1), ...fM.slice(1), ...fF.slice(1)
]);

const progress_total = TEST_STIMULI.length;

// Присваиваем анонимные порядковые номера для отображения
TEST_STIMULI.forEach((stim, index) => {
  stim.display_id = index + 1;
});

// --- Передача данных ---
function postJSON(obj) {
  const data = { 
    ...obj, 
    participant_id, 
    ts: nowIso(),
    age: participant_age,
    gender: participant_gender 
  };
  
  fetch(DATA_ENDPOINT, {
    method: "POST",
    mode: "no-cors", 
    cache: "no-cache",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).catch(err => console.error("Ошибка отправки:", err));
}

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  on_finish: () => {
    document.body.innerHTML = `<div class="jspsych-content"><h2>Спасибо!</h2><p>Ваши данные успешно сохранены. Теперь вы можете закрыть вкладку.</p></div>`;
  }
});

const timeline = [];

// 1. АНКЕТА
timeline.push({
  type: jsPsychSurveyHtmlForm,
  preamble: "<h2>Добро пожаловать!</h2><p>Пожалуйста, ответьте на вопросы перед началом.</p>",
  html: `
    <div style="margin-bottom: 20px; text-align: left; display: inline-block;">
      <p> Ваш возраст: <input name="age" type="number" required style="width: 50px;" /> </p>
      <p> Ваш пол: 
        <select name="gender" required>
          <option value="">--выберите--</option>
          <option value="M">Мужской</option>
          <option value="F">Женский</option>
        </select>
      </p>
      <p>
        <label style="cursor:pointer;">
          <input type="checkbox" name="train" style="width:18px; height:18px;" />
          <b>Включить тренировку</b>
        </label>
      </p>
    </div>
  `,
  button_label: "Далее",
  on_finish: (data) => {
    participant_age = data.response.age;
    participant_gender = data.response.gender;
    include_training = (data.response.train !== undefined);
    postJSON({ kind: "session_start", include_training });
  }
});

// 2. Блок Тренировки
const training_procedure = {
  timeline: [
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: "<h3>Тренировка</h3><p>Сейчас будет 4 примера с обратной связью.</p>",
      choices: ["Начать"]
    },
    ...TRAINING_STIMULI.flatMap(stim => [
      {
        type: jsPsychImageButtonResponse,
        stimulus: stim.url,
        choices: ["Реальное", "ИИ"],
        prompt: "<p>Это реальный человек или ИИ?</p>",
        data: { phase: "train", task: "judge", true_class: stim.class },
        on_finish: (data) => {
          data.correct = ( (data.response === 0 ? "real" : "fake") === stim.class );
        }
      },
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: () => {
          const last = jsPsych.data.get().last(1).values()[0];
          return last.correct ? "<h2 style='color:green'>Верно</h2>" : "<h2 style='color:red'>Неверно</h2>";
        },
        choices: ["Далее"],
        trial_duration: 1200
      }
    ])
  ],
  conditional_function: () => include_training
};
timeline.push(training_procedure);

// 3. Основной тест
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: "<h3>Основная часть</h3><p>После нажатия на кнопку начнётся тест. Пожалуйста, старайтесь обосновывать свои решения.</p>",
  choices: ["Начать тест"]
});

TEST_STIMULI.forEach((stim) => {
  const judge_trial = {
    type: jsPsychImageButtonResponse,
    stimulus: stim.url,
    choices: ["Реальное", "ИИ-сгенерировано"],
    prompt: `
      <div style="margin-top: 20px;">
        <div class="img-id" style="margin-bottom: 10px;">Изображение <b>${stim.display_id}</b> из ${progress_total}</div>
        <textarea id="reasons_input" 
                  placeholder="Объясните причину вашего выбора..." 
                  style="width: 350px; height: 70px; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-family: sans-serif;"></textarea>
      </div>
    `,
    data: { phase: "test", task: "judge", ...stim },
    
    on_load: function() {
      window._current_reason = "";
      const input = document.getElementById('reasons_input');
      if (input) {
        input.focus(); // Устанавливаем фокус на поле ввода
        input.addEventListener('input', function(e) {
          window._current_reason = e.target.value;
        });
      }
    },
    
    on_finish: (data) => {
      const free_reason = window._current_reason || "";
      const isAI = (data.response === 1);
      
      data.correct = (isAI === (stim.class === "fake"));
      data.reason_free = free_reason;

      progress_done++;
      jsPsych.setProgressBar(progress_done / progress_total);

      postJSON({
        kind: "judge",
        image_id: stim.id, // В базу идет исходный ID (RM_01 и т.д.)
        answer: isAI ? "ai" : "real",
        correct: data.correct,
        rt: data.rt,
        reason: free_reason 
      });
      
      window._current_reason = "";
    }
  };

  timeline.push(judge_trial);
});

// 4. Финальный экран с результатами
timeline.push({
  type: jsPsychHtmlButtonResponse,
  choices: ["Завершить"],
  stimulus: () => {
    // Получаем все данные из фазы теста
    const trials = jsPsych.data.get().filter({phase: 'test'});
    const correct_trials = trials.filter({correct: true});
    
    // Считаем точность
    const accuracy = Math.round((correct_trials.count() / trials.count()) * 100);
    
    return `
      <h2>Результаты теста</h2>
      <p>Вы правильно определили <b>${correct_trials.count()}</b> из <b>${trials.count()}</b> изображений.</p>
      <p style="font-size: 1.2em;">Ваша точность: <b>${accuracy}%</b></p>
      <p>Спасибо за участие! Нажмите кнопку, чтобы отправить данные.</p>
    `;
  }
});

jsPsych.run(timeline);