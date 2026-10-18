# 🐾 קוקו – הוראות הקמה

האפליקציה עובדת מיד במצב הדגמה. כדי ששניכם תראו את אותם נתונים מכל טלפון, צריך לחבר אותה ל-Firebase (חינם, תוכנית Spark).

## 1. Firebase
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → שם, למשל `koko-app` (פרויקט נפרד מהמשחק).
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Users → Add user**: משתמש בשבילך ומשתמש בשביל נגה (מייל + סיסמה).
4. **Build → Firestore Database → Create database** (מיקום: `eur3` או קרוב אחר) → Production mode.
5. **Firestore → Rules**: מדביקים את התוכן של `firestore.rules`, מחליפים את שני המיילים לשלכם (באותיות קטנות) → **Publish**.
6. **Project settings (⚙️) → General → Your apps → `</>` Web** → רושמים אפליקציה ומעתיקים את ה-`firebaseConfig` לקובץ `firebase-config.js`.

## 2. GitHub Pages
1. ריפו חדש (למשל `koko`) → מעלים את כל הקבצים כמו שהם (כולל התיקייה `icons`).
2. **Settings → Pages → Deploy from branch → main / root**.
3. אחרי דקה האפליקציה תהיה ב-`https://<username>.github.io/koko/`.

## 3. בטלפון
- **אייפון**: פותחים בספארי → כפתור שיתוף → **הוספה למסך הבית**.
- **אנדרואיד**: פותחים בכרום → ⋮ → **התקנת אפליקציה**.

## הערות
- תמונות נשמרות דחוסות בתוך Firestore, כך שלא צריך את Firebase Storage (שדורש תוכנית בתשלום).
- העדכונים מסונכרנים בזמן אמת בין שני הטלפונים, ועובדים גם בלי קליטה (מסתנכרן כשחוזרת).
- תזכורות: בעריכת טיפול (⋯) יש **📅 הוספה ליומן** – יוצר אירוע ביום המועד עם התראה יום לפני.
- עדכון גרסה: משנים את `VERSION` ב-`app.js` ואת `CACHE` ב-`sw.js` לאותו מספר.
