// ===== 業務畫面：每個畫面一個大圖示（public/icons/）＋短標題＋一句話＋最多兩個按鈕 =====
// 顏色規則（依講義）：紅＝警示（只給家屬）、黃＝提醒與「等一下」、綠＝通過與「吃好了」、藍＝功能、不帶狀態。

import { APP } from './config.js';

export const screens = {
  // 給長輩
  remind: ({ med, reminderId }) => ({
    color: 'yellow',
    icon: '02_yellow_remind.png',
    title: '吃藥囉',
    text: med,
    buttons: [
      { label: '吃好了', data: `a=done&r=${reminderId}`, color: 'green' },
      { label: '等一下', data: `a=snooze&r=${reminderId}`, color: 'yellow' },
    ],
  }),
  snoozed: ({ minutes }) => ({
    color: 'yellow',
    icon: '04_yellow_wait.png',
    title: '好的',
    text: `${minutes}分鐘後再提醒`,
  }),
  done: () => ({
    color: 'green',
    icon: '03_green_done.png',
    title: '記好了',
    text: `${APP.elderCall}好棒`,
  }),
  alreadyDone: () => ({
    color: 'green',
    icon: '03_green_done.png',
    title: '記好了',
    text: '這次已經吃過了',
  }),
  // 長輩按圖文選單「打給家人」後的確認
  callSent: () => ({
    color: 'blue',
    icon: '06_blue_call.png',
    title: '好的',
    text: '已通知家人',
  }),

  // 「打給家人」有家人接手 → 告訴長輩誰會打來（名字過長時截短，維持字數限制）
  callClaimed: ({ name }) => ({
    color: 'blue',
    icon: '06_blue_call.png',
    title: '家人會打來',
    text: `${[...name].slice(0, 8).join('')}會打給你`,
  }),

  // 給家屬群組
  alert: ({ time, med, reminderId }) => ({
    color: 'red',
    icon: '05_red_not_taken.png',
    title: '還沒吃藥',
    text: `${APP.elderName}${time}${med}`,
    buttons: [{ label: '我來打電話', data: `a=claim&r=${reminderId}`, color: 'blue' }],
  }),
  // 長輩按「打給家人」→ 家屬群組收到（功能請求，不帶狀態，用藍色）
  callRequest: ({ callId }) => ({
    color: 'blue',
    icon: '06_blue_call.png',
    title: `${APP.elderName}找你`,
    text: `請打電話給${APP.elderName}`,
    buttons: [{ label: '我來打電話', data: `a=claim_call&c=${callId}`, color: 'blue' }],
  }),
  claimed: ({ name }) => ({
    color: 'blue',
    icon: '06_blue_call.png',
    title: '有人接手',
    text: `${name}會打電話`,
  }),
};

// 預覽頁與字數測試用的範例資料
export const SAMPLES = {
  remind: { med: '降血壓藥', reminderId: 1 },
  snoozed: { minutes: 10 },
  done: {},
  alreadyDone: {},
  callSent: {},
  callClaimed: { name: '小明' },
  callRequest: { callId: 1 },
  alert: { time: '08:00', med: '降血壓藥', reminderId: 1 },
  claimed: { name: '小明' },
};

export const ELDER_SCREENS = ['remind', 'snoozed', 'done', 'alreadyDone', 'callSent', 'callClaimed'];
export const FAMILY_SCREENS = ['alert', 'callRequest', 'claimed'];
