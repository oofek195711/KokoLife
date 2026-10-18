# 🐾 קוקו – מבנה הקבצים

```
KokoLife/
├── index.html    ← משתנה בעדכונים
├── app.js        ← משתנה בעדכונים
├── style.css     ← משתנה בעדכונים
├── sw.js         (קבוע)
└── core/         (קבוע – כמעט אף פעם לא משתנה)
    ├── store.js
    ├── firebase-config.js
    ├── manifest.json
    ├── firestore.rules   ← לא מעלים ל-GitHub חובה; זה רק עותק של הכללים להדבקה ב-Firebase
    └── icons/
```

## עדכון רגיל
מעלים ל-GitHub רק את הקבצים שמופיעים בהודעה (בדרך כלל `index.html`, `app.js`, `style.css`).
מספר הגרסה מופיע בתחתית האפליקציה.

## כללי Firestore
העתיקו את `core/firestore.rules` ל-Firebase → Firestore Database → Rules → Publish.
