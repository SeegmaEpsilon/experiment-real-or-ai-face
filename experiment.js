/* experiment.js */

const DATA_ENDPOINT = "https://script.google.com/macros/s/AKfycbxRQ0t6gX5DZdq069OPZswTq2OYEMP6gtOcEirggM3Q-uHwdVPzd6EnOfMUvZraaKv4jQ/exec";

let participant_age = "";
let participant_gender = "";
let participant_occupation = "";
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

const rM = shuffle(makeSeq("img/real/man",   "RM_", "real", "real", "M"));
const rF = shuffle(makeSeq("img/real/woman", "RW_", "real", "real", "F"));
const fM = shuffle(makeSeq("img/fake/man",   "FM_", "fake", "A",    "M"));
const fF = shuffle(makeSeq("img/fake/woman", "FW_", "fake", "A",    "F"));

const TRAINING_STIMULI = [rM[0], rF[0], fM[0], fF[0]];
const TEST_STIMULI = shuffle([...rM.slice(1), ...rF.slice(1), ...fM.slice(1), ...fF.slice(1)]);
const progress_total = TEST_STIMULI.length;

TEST_STIMULI.forEach((stim, index) => { stim.display_id = index + 1; });

// --- Передача данных ---
function postJSON(obj) {
  const data = { 
    ...obj, 
    participant_id, 
    ts: nowIso(),
    age: participant_age,
    gender: participant_gender,
    occupation: participant_occupation
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
    document.body.innerHTML = `
      <div style="text-align:center; margin-top: 15%; font-family: sans-serif;">
        <h2>Спасибо!</h2>
        <p>Ваши данные успешно сохранены. Теперь вы можете закрыть вкладку.</p>
      </div>`;
  }
});

const timeline = [];

// 1. АНКЕТА
timeline.push({
  type: jsPsychSurveyHtmlForm,
  preamble: "<h2>Тест на распознавание синтетических лиц</h2><p>Пожалуйста, ответьте на вопросы перед началом.</p>",
  html: `
    <div style="margin-bottom: 20px; text-align: left; display: inline-block;">
      <p> Ваш возраст: <input name="age" type="number" required style="width: 60px;" /> </p>
      <p> Ваш пол: 
        <select name="gender" required>
          <option value="">--выберите--</option>
          <option value="M">Мужской</option>
          <option value="F">Женский</option>
        </select>
      </p>
      <p> Род деятельности: 
        <input name="occupation" type="text" required placeholder="Студент РТФ, дизайнер, оператор ЧПУ..." style="width: 280px;" /> 
      </p>
      <p>
        <label style="cursor:pointer;">
          <input type="checkbox" name="train" style="width:18px; height:18px;" />
          <b>Включить тренировку</b>
        </label>
      </p>
      <p style="font-size: 0.85em; color: #718096; margin-top: 20px;">
        Проходя этот тест, вы соглашаетесь с 
        <a href="#" id="consent-link" style="color: #4299e1; text-decoration: underline;">согласием на эксперимент</a>
      </p>
    </div>

    <div id="consent-modal" class="modal-overlay">
      <div class="modal-content">
        <h3>Информированное согласие</h3>
        <div style="text-align: left; max-height: 350px; overflow-y: auto; padding-right: 10px;">
          <p><b>Суть задания:</b> вам будет показана серия из 36 изображений лиц людей. Для каждого изображения нужно выбрать: «Реальное» или «ИИ-сгенерировано» и обосновать свой выбор.</p>
          <p><b>Ваши права и данные:</b><br>
          • <b>Анонимность.</b> Мы не собираем ФИО/контакты/дату рождения/IP и прочее. Все данные обезличены (случайный UUID), исходный код открытый.<br>
          • <b>Наука.</b> Результаты используются только в исследовательских целях.<br>
          • <b>Добровольность.</b> Вы можете прекратить опрос в любой момент.<br>
          • <b>Риски.</b> Контент безопасен; риски минимальны.</p>
        </div>
        <button type="button" id="close-modal" class="modal-close-btn">Понятно</button>
      </div>
    </div>
  `,
  button_label: "Далее",
  on_load: () => {
    const modal = document.getElementById('consent-modal');
    const link = document.getElementById('consent-link');
    const closeBtn = document.getElementById('close-modal');

    // Открыть
    link.addEventListener('click', (e) => {
      e.preventDefault();
      modal.style.display = 'flex';
    });

    // Закрыть по кнопке
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Закрыть при клике на темный фон
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  },
  on_finish: (data) => {
    participant_age = data.response.age;
    participant_gender = data.response.gender;
    participant_occupation = data.response.occupation;
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
  stimulus: "<h3>Основная часть</h3><p>Пожалуйста, старайтесь цензурно обосновывать свои решения.</p>",
  choices: ["Начать тест"]
});

TEST_STIMULI.forEach((stim) => {
  const judge_trial = {
    type: jsPsychImageButtonResponse,
    stimulus: stim.url,
    choices: ["Реальное", "ИИ-сгенерировано"],
    // Кнопки выключены через CSS селектор при загрузке
    button_html: '<button class="jspsych-btn" id="btn-%choice%" disabled>%choice%</button>', 
    prompt: `
      <div style="margin-top: 20px;">
        <div class="img-id" style="margin-bottom: 10px;">Изображение <b>${stim.display_id}</b> из ${progress_total}</div>
		<p id="warning" style="color: #c20000; font-size: 0.85em; margin-top: 8px;">Введите причину, чтобы активировать кнопки (минимум 5 символов).</p>
        <textarea id="reasons_input" 
                  placeholder="Объясните причину вашего выбора..." 
                  style="width: 350px; height: 70px; padding: 10px; font-family: sans-serif;"></textarea>
      </div>
    `,
    data: { phase: "test", task: "judge", ...stim },
    
    on_load: function() {
      window._current_reason = "";
      const input = document.getElementById('reasons_input');
      const warning = document.getElementById('warning');
      const buttons = document.querySelectorAll('.jspsych-btn');

      if (input) {
        input.focus();
        input.addEventListener('input', function(e) {
          const val = e.target.value.trim();
          window._current_reason = val;
          
          if (val.length >= 5) {
            buttons.forEach(btn => btn.disabled = false);
            if(warning) warning.style.visibility = "hidden";
          } else {
            buttons.forEach(btn => btn.disabled = true);
            if(warning) warning.style.visibility = "visible";
          }
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
        image_id: stim.id,
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
    const trials = jsPsych.data.get().filter({phase: 'test'});
    const correct_trials = trials.filter({correct: true});
    const accuracy = Math.round((correct_trials.count() / trials.count()) * 100);
    
    return `
      <h2>Результаты теста</h2>
      <p>Вы правильно определили <b>${correct_trials.count()}</b> из <b>${trials.count()}</b> изображений.</p>
      <p style="font-size: 1.4em; color: #2b6cb0;">Ваша точность: <b>${accuracy}%</b></p>
      <p>Спасибо за участие! Нажмите кнопку, чтобы отправить данные.</p>
    `;
  }
});

jsPsych.run(timeline);