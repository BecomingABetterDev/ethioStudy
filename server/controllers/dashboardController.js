const Task = require('../models/Task');
const Session = require('../models/Session');

// ─── Main Dashboard Aggregation ───────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // ── Date helpers ──────────────────────────────────────────────────────
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // ── Run aggregations in parallel ──────────────────────────────────────
    const [
      tasksDueToday,
      completedTasksCount,
      pendingTasksCount,
      inProgressTasksCount,
      weekSessions,
      recentSessions,
      subjectBreakdown,
      dailyActivity,
    ] = await Promise.all([
      // Tasks due today (not archived, not completed)
      Task.find({
        userId,
        isArchived: false,
        status: { $ne: 'Completed' },
        dueDate: { $gte: todayStart, $lte: todayEnd },
      })
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),

      // Completed tasks count
      Task.countDocuments({ userId, isArchived: false, status: 'Completed' }),

      // Pending tasks count
      Task.countDocuments({ userId, isArchived: false, status: 'Pending' }),

      // In-progress tasks count
      Task.countDocuments({ userId, isArchived: false, status: 'In Progress' }),

      // Sessions this week
      Session.find({
        userId,
        completedAt: { $gte: weekStart },
      }).lean(),

      // Last 5 sessions
      Session.find({ userId })
        .sort({ completedAt: -1 })
        .limit(5)
        .lean(),

      // Minutes by subject (last 30 days)
      Session.aggregate([
        { $match: { userId, completedAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$subject', totalMinutes: { $sum: '$duration' } } },
        { $sort: { totalMinutes: -1 } },
        { $limit: 5 },
      ]),

      // Daily activity for the last 7 days
      Session.aggregate([
        { $match: { userId, completedAt: { $gte: weekStart } } },
        {
          $group: {
            _id: { 
              $dateToString: { 
                format: "%Y-%m-%d", 
                date: "$completedAt",
                timezone: "Africa/Addis_Ababa" // Adjust to your preferred local timezone
              } 
            },
            totalMinutes: { $sum: '$duration' },
            sessions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // ── Compute study hours this week ─────────────────────────────────────
    const weeklyMinutes = weekSessions.reduce((acc, s) => acc + s.duration, 0);
    const weeklyHours = +(weeklyMinutes / 60).toFixed(1);

    // ── Compute study streak (consecutive days) ───────────────────────────
    const streak = await computeStreak(userId, now);

    // ── Most studied subject ──────────────────────────────────────────────
    const mostStudiedSubject = subjectBreakdown.length > 0 ? subjectBreakdown[0]._id : null;

    // ── Build full 7-day activity map ─────────────────────────────────────
    const weeklyActivity = buildWeeklyActivityMap(dailyActivity, weekStart, now);

//     console.log('dailyActivity:', dailyActivity);
// console.log('weeklyActivity:', weeklyActivity);

    res.json({
      success: true,
      data: {
        stats: {
          tasksDueTodayCount: tasksDueToday.length,
          completedTasksCount,
          pendingTasksCount,
          inProgressTasksCount,
          weeklyStudyHours: weeklyHours,
          weeklyStudyMinutes: weeklyMinutes,
          studyStreak: streak,
          mostStudiedSubject,
        },
        tasksDueToday,
        recentSessions,
        subjectBreakdown: subjectBreakdown.map((s) => ({
          subject: s._id,
          minutes: s.totalMinutes,
          hours: +(s.totalMinutes / 60).toFixed(1),
        })),
        weeklyActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeStreak(userId, now) {
  // Fetch session dates for the last 60 days
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  sixtyDaysAgo.setHours(0, 0, 0, 0);

  const sessions = await Session.find(
    { userId, completedAt: { $gte: sixtyDaysAgo } },
    { completedAt: 1 }
  ).lean();

  if (sessions.length === 0) return 0;

  // Build a set of unique YYYY-MM-DD dates
  // const studyDates = new Set(
  //   sessions.map((s) => s.completedAt.toISOString().slice(0, 10))
  // );

  const studyDates = new Set(
    sessions.map((s) => {
      const d = new Date(s.completedAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    })
  );

  let streak = 0;
  const check = new Date(now);
  check.setHours(0, 0, 0, 0);

  // // Allow today or yesterday to start streak
  // const todayStr = check.toISOString().slice(0, 10);
  // const yesterdayCheck = new Date(check);
  // yesterdayCheck.setDate(check.getDate() - 1);
  // const yesterdayStr = yesterdayCheck.toISOString().slice(0, 10);

  function formatDateToLocalString(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  const todayStr = formatDateToLocalString(check);
  const yesterdayCheck = new Date(check);
  yesterdayCheck.setDate(check.getDate() - 1);
  const yesterdayStr = formatDateToLocalString(yesterdayCheck);

  if (!studyDates.has(todayStr) && !studyDates.has(yesterdayStr)) return 0;

  const startDate = studyDates.has(todayStr) ? check : yesterdayCheck;

  let cursor = new Date(startDate);
  // while (true) {
  //   const dateStr = cursor.toISOString().slice(0, 10);
  //   if (studyDates.has(dateStr)) {
  //     streak++;
  //     cursor.setDate(cursor.getDate() - 1);
  //   } else {
  //     break;
  //   }
  // }

  while (true) {
    const dateStr = formatDateToLocalString(cursor);
    if (studyDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function buildWeeklyActivityMap(dailyActivity, weekStart, now) {
  const map = {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const todayY = now.getFullYear();
  const todayM = String(now.getMonth() + 1).padStart(2, '0');
  const todayD = String(now.getDate()).padStart(2, '0');
  const todayStr = `${todayY}-${todayM}-${todayD}`;

  // Pre-populate all 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    // const key = d.toISOString().slice(0, 10);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;

    map[key] = {
      day: days[i],
      minutes: 0,
      isToday: key === todayStr
    };
  }

  // Fill in actual data

  if (Array.isArray(dailyActivity)) {
    dailyActivity.forEach((day) => {
      const totalMins = day.duration || day.minutes || day.totalMinutes || 0;
  
      // const dateKey = day._id && day._id.includes('T') ? day._id.slice(0, 10) : day._id;
      if (map[day._id]) {
        map[day._id].minutes = totalMins;
        map[day._id].sessions = day.sessions;
      }
    });
  }

  // dailyActivity.forEach((day) => {
  //   const totalMins = day.duration || day.minutes || day.totalMinutes || 0;

  //   if (map[day._id]) {
  //     map[day._id].minutes = day.totalMinutes;
  //     map[day._id].sessions = day.sessions;
  //   }
  // });

  return Object.values(map);
}

module.exports = { getDashboard };
