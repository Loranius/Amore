'use strict';
/* ============================================================
   GAME MENU — кнопки вибору розділу на тайтл-скріні.
   ============================================================ */
$('chSadok').addEventListener('click',()=>{ void startSadokChapter(); });
$('ch1').addEventListener('click',()=>{ void startSchoolChapter(1); });
$('ch2').addEventListener('click',()=>{ void startSchoolChapter(2); });
$('ch3').addEventListener('click',()=>{ void startSchoolChapter(3); });
$('ch4').addEventListener('click',()=>{ void startSchoolChapter(4); });
$('startBtn').addEventListener('click',()=>{ void startFullStory(); });
