# סקאוט ליגה ג' — כלי איסוף חי + ניתוח משחק

PWA (Progressive Web App) ב-Next.js לאיסוף אירועים חי בטלפון בזמן משחק, שמירה ל-Supabase, וניתוח לאחר המשחק עם מדד השפעה (Impact Score), פירוק לפי אזורים, ייצוא CSV ורשימת נקודות לחיתוך וידאו.

## מה זה נותן לך
- **בזמן המשחק (לייב):** מסך הרכב 4-3-3 עם 10 שחקני שדה. לוחצים על שחקן במגרש, בוחרים פעולה (איבוד / חילוץ / מסירת מפתח / איום / שער / בישול), ואז אזור או רחבה. קרנות נרשמות בלי שחקן.
- **עמידות לרשת חלשה:** כל אירוע נשמר קודם מקומית (localStorage) ומסתנכרן ל-Supabase כשיש רשת. לא מאבדים נתונים גם בלי קליטה.
- **אחרי המשחק (דוח):** טבלת Impact Score לכל שחקן, פירוק איבודים/חילוצים לפי אזור, איומים בתוך/מחוץ לרחבה, מסירות מפתח, ייצוא CSV, ורשימת דקות של איבודים בשליש ההגנתי לחיתוך הווידאו.

## שלושת השאלות שהמערכת עונה עליהן למאמן
1. מי היה הכי משפיע/מזיק? (Impact Score)
2. איפה מאבדים ומרוויחים כדורים? (פירוק 3 אזורים)
3. האם מייצרים מצבים איכותיים? (רחבה מול חוץ + מסירות מפתח)

## הגדרה ראשונית

### 1. פרויקט Supabase
1. היכנס ל-[supabase.com](https://supabase.com) וצור פרויקט חדש (חינם).
2. פתח **SQL Editor → New query**, הדבק את התוכן של [`db/schema.sql`](db/schema.sql) והרץ (Run).
   - אם כבר יש לך DB ישן: הרץ לפי הסדר את `db/migration_v2.sql` … עד `db/migration_v10.sql` (שדה סיסמה לכניסה).
3. פתח **Project Settings → API** והעתק את `Project URL` ואת `anon public key`.

### 2. משתני סביבה
העתק את `.env.local.example` ל-`.env.local` ומלא:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. הרצה מקומית
```bash
npm install
npm run dev
```
פתח http://localhost:3000

## פריסה ל-Vercel (מומלץ)
1. דחוף את הקוד ל-GitHub.
2. ב-[vercel.com](https://vercel.com) → **New Project** → בחר את הריפו.
3. תחת **Environment Variables** הוסף את `NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy**.
5. בטלפון: פתח את הכתובת בדפדפן → תפריט → **הוסף למסך הבית**. עכשיו זו אפליקציה.

## כניסת מאמן / שחקן
1. הרץ ב-Supabase SQL Editor את [`db/migration_v9.sql`](db/migration_v9.sql) ואז את [`db/migration_v10.sql`](db/migration_v10.sql).
2. בטבלת `app_users` מלא ידנית: `username`, `password`, `role` (`coach` או `player`). לשחקן מלא גם `squad_player_id`.

```sql
insert into public.app_users (username, password, role)
values ('מאמן', 'סיסמה-שלך', 'coach');

insert into public.app_users (username, password, role, squad_player_id)
values ('גיא חזן', 'סיסמה-לשחקן', 'player', 'uuid-של-השחקן-בסגל');
```

שחקן רואה ספירה לאחור, לוח שנה, והנתונים שלו בלבד. מאמן רואה הכול, כולל לייב ויצירת משחקים.

> ה-Service Worker (מטמון אופליין) פעיל רק ב-build פרודקשן, לא ב-`npm run dev`.

## כיול מדד ההשפעה
כל המשקולות נמצאות בקובץ אחד: [`lib/impactScore.ts`](lib/impactScore.ts) → הקבוע `IMPACT_WEIGHTS`. ברירת המחדל:

| פעולה | ניקוד |
|---|---|
| מסירת מפתח | +2 |
| חילוץ בשליש מרכזי/התקפי | +1.5 |
| חילוץ בשליש הגנתי | +0.5 |
| איום מתוך הרחבה | +1 |
| איבוד בשליש הגנתי | -2 |

שנה את המספרים אחרי כמה משחקים לפי מה שהמאמן מרגיש שנכון.

## מבנה הפרויקט
```
app/
  page.tsx                 רשימת משחקים
  setup/page.tsx           הקמת משחק + סגל
  live/[matchId]/          מסך איסוף חי + שעון משחק
  report/[matchId]/        דוח ניתוח + ייצוא
lib/
  supabaseClient.ts        חיבור ל-Supabase
  db.ts                    שליפה/כתיבה של matches/players/events
  eventQueue.ts            תור אופליין ב-localStorage
  impactScore.ts           חישוב מדד ההשפעה (משקולות)
  exportCsv.ts             ייצוא CSV
  types.ts                 טיפוסים ותוויות בעברית
db/schema.sql              סכמת בסיס הנתונים ל-Supabase
```
