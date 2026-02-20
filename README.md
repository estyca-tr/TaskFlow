# One-on-One Manager

כלי לניהול שיחות 1:1 עם עובדים וקולגות, כולל תיעוד, מעקב נושאים, ניהול משימות, וניתוח AI.

## תכונות

### ניהול אנשים
- **עובדים וקולגות** - הבחנה בין עובדים כפופים לקולגות/עמיתים
- **פרופילים** - הוספה, עריכה וצפייה בפרופילים עם תפקיד, מחלקה ועוד
- **נושאים לדיון** - מעקב אחר נושאים שצריך לדון עליהם עם כל אדם

### ניהול משימות
- **משימות אישיות** - משימות של המנהל/ת שלא קשורות לאדם ספציפי
- **נושאים לדיון** - משימות לדיון עם אדם ספציפי בפגישה הבאה
- **משימות מישיבה** - יצירת משימות אוטומטית מהערות ישיבה (AI)
- **סטטוסים** - ממתין, בביצוע, הושלם
- **עדיפויות** - נמוכה, בינונית, גבוהה
- **תאריכי יעד** - מעקב אחר משימות שפג תוקפן

### תיעוד שיחות
- **רישום מפגשים** - תיעוד עם הערות, נושאים ומשימות
- **מעקב מצב רוח** - תיעוד ומעקב אחר מצב הרוח ושביעות הרצון
- **חילוץ משימות** - חילוץ אוטומטי של משימות מהערות הישיבה

### ניתוח AI
- **חילוץ תובנות** - ניתוח הערות שיחה לחילוץ נושאים וסנטימנט
- **חילוץ משימות** - זיהוי אוטומטי של action items מהערות
- **תמיכה ב-OpenAI ו-Anthropic** - או ניתוח מבוסס חוקים כ-fallback

### אנליטיקס
- **גרפים ודוחות** - מגמות, נושאים חוזרים ועוד
- **דשבורד** - סקירה מהירה של משימות להיום, שיחות אחרונות ועוד

## דרישות

- Python 3.9+
- Node.js 18+

## התקנה

### Backend

```bash
cd OneOnOneManager/backend

# יצירת virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# או: venv\Scripts\activate  # Windows

# התקנת חבילות
pip install -r requirements.txt

# הרצה
uvicorn main:app --reload
```

ה-API יהיה זמין ב-`http://localhost:8000`
תיעוד API ב-`http://localhost:8000/docs`

### Frontend

```bash
cd OneOnOneManager/frontend

# התקנת חבילות
npm install

# הרצה
npm run dev
```

האפליקציה תהיה זמינה ב-`http://localhost:5173`

## שימוש ב-AI

לניתוח AI מתקדם, הגדר אחד ממפתחות ה-API הבאים:

```bash
# OpenAI
export OPENAI_API_KEY=your-key-here

# או Anthropic
export ANTHROPIC_API_KEY=your-key-here
```

אם לא מוגדר מפתח, המערכת תשתמש בניתוח מבוסס חוקים בסיסי.

## מבנה הפרויקט

```
OneOnOneManager/
├── backend/
│   ├── main.py              # נקודת כניסה FastAPI
│   ├── database.py          # הגדרות SQLite
│   ├── models.py            # מודלים של DB (Employee, Meeting, Task...)
│   ├── schemas.py           # Pydantic schemas
│   ├── routers/
│   │   ├── employees.py     # API אנשים (עובדים/קולגות)
│   │   ├── meetings.py      # API שיחות
│   │   ├── tasks.py         # API משימות
│   │   └── analytics.py     # API אנליטיקס
│   └── services/
│       └── ai_analyzer.py   # שירות ניתוח AI וחילוץ משימות
├── frontend/
│   ├── src/
│   │   ├── components/      # קומפוננטות React
│   │   ├── pages/           # דפי האפליקציה
│   │   │   ├── Dashboard    # דשבורד ראשי
│   │   │   ├── MyTasks      # ניהול משימות
│   │   │   ├── People       # ניהול אנשים
│   │   │   └── ...
│   │   ├── services/        # שירותי API
│   │   └── styles/          # קבצי CSS
│   └── package.json
└── README.md
```

## API Endpoints

### אנשים (עובדים/קולגות)
- `GET /api/employees` - רשימת אנשים (עם פילטר person_type)
- `GET /api/employees/{id}` - אדם ספציפי
- `POST /api/employees` - יצירת עובד/קולגה
- `PUT /api/employees/{id}` - עדכון
- `DELETE /api/employees/{id}` - מחיקה

### משימות
- `GET /api/tasks` - כל המשימות (עם פילטרים)
- `GET /api/tasks/my` - משימות אישיות בלבד
- `GET /api/tasks/today` - משימות להיום
- `GET /api/tasks/discuss/{person_id}` - נושאים לדיון עם אדם
- `POST /api/tasks` - יצירת משימה
- `PUT /api/tasks/{id}` - עדכון משימה
- `POST /api/tasks/{id}/complete` - סימון כהושלם
- `DELETE /api/tasks/{id}` - מחיקה
- `POST /api/tasks/bulk` - יצירת מספר משימות

### שיחות
- `GET /api/meetings` - רשימת שיחות
- `GET /api/meetings/{id}` - שיחה ספציפית
- `POST /api/meetings` - יצירת שיחה
- `PUT /api/meetings/{id}` - עדכון שיחה
- `DELETE /api/meetings/{id}` - מחיקת שיחה
- `POST /api/meetings/{id}/action-items` - הוספת action item
- `POST /api/meetings/{id}/topics` - הוספת נושא
- `POST /api/meetings/{id}/extract-tasks` - חילוץ משימות מהערות (AI)

### אנליטיקס
- `GET /api/analytics/overview` - סקירה כללית
- `GET /api/analytics/employee/{id}` - אנליטיקס לאדם
- `GET /api/analytics/action-items/pending` - action items פתוחים
- `GET /api/analytics/topics/trends` - מגמות נושאים
- `POST /api/analytics/analyze` - ניתוח AI

## רישיון

MIT

