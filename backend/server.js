import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";
import multer from "multer";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ─── FIREBASE ADMIN ───────────────────────
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "inspireed-299c0.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ─── FILE UPLOAD CONFIG ───────────────────
const upload = multer({ storage: multer.memoryStorage() });

/* ─────────────────────────────────────────
   CREATE USER (ADMIN ONLY)
────────────────────────────────────────── */
app.post("/create-user", async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const userRecord = await admin.auth().createUser({ email, password });

    await db.collection("users").doc(userRecord.uid).set({
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "User created successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────
   CREATE COURSE (TEACHER)
────────────────────────────────────────── */
app.post("/courses", async (req, res) => {
  const { title, description, teacherId } = req.body;

  try {
    const courseRef = await db.collection("courses").add({
      title,
      description,
      teacherId,
      students: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Course created", courseId: courseRef.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────
   ADD STUDENT TO COURSE
────────────────────────────────────────── */
app.post("/courses/add-student", async (req, res) => {
  const { courseId, studentId } = req.body;

  try {
    await db.collection("courses").doc(courseId).update({
      students: admin.firestore.FieldValue.arrayUnion(studentId),
    });

    res.json({ message: "Student added" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────
   UPLOAD STUDY MATERIAL
────────────────────────────────────────── */
app.post("/materials", upload.single("file"), async (req, res) => {
  const { courseId, title, teacherId } = req.body;

  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const blob = bucket.file(`materials/${Date.now()}-${file.originalname}`);
    const blobStream = blob.createWriteStream({ resumable: false });

    blobStream.end(file.buffer);

    blobStream.on("finish", async () => {
      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      await db.collection("materials").add({
        courseId,
        title,
        fileUrl,
        teacherId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ message: "Material uploaded", fileUrl });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET SINGLE COURSE
app.get("/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;

  try {
    const doc = await db.collection("courses").doc(courseId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json({
      id: doc.id,
      ...doc.data(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET COURSES FOR STUDENT
app.get("/student/courses/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    const snapshot = await db
      .collection("courses")
      .where("students", "array-contains", studentId)
      .get();

    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(courses);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET MATERIALS FOR COURSE
app.get("/materials/:courseId", async (req, res) => {
  const { courseId } = req.params;

  try {
    const snapshot = await db
      .collection("materials")
      .where("courseId", "==", courseId)
      .get();

    const materials = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(materials);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── LEARNING PATTERNS ────────────────────
// ─── LEARNING PATTERNS ────────────────────
app.post("/learning-patterns", async (req, res) => {
  const { courseId, studentId, answers, pattern } = req.body;

  try {
    // Store in a subcollection under the user for better organization
    await db.collection("users").doc(studentId).collection("course_patterns").doc(courseId).set({
      courseId,
      studentId,
      answers,
      pattern,
      learningLevel: 3, // Initial level: 1=very slow, 3=average, 5=advanced
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Learning pattern saved successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/learning-patterns/:courseId/:studentId", async (req, res) => {
  const { courseId, studentId } = req.params;

  try {
    const doc = await db.collection("users").doc(studentId).collection("course_patterns").doc(courseId).get();

    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.status(404).json({ error: "Pattern not found" });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET learning style distribution for all students in a course + performance per style
app.get("/analytics/learning-styles/:courseId", async (req, res) => {
  const { courseId } = req.params;

  try {
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) return res.status(404).json({ error: "Course not found" });

    const studentIds = courseDoc.data().students || [];
    const counts = { direct: 0, analogy: 0, interactive: 0 };
    const scores = { direct: [], analogy: [], interactive: [] };

    for (const studentId of studentIds) {
      const patternDoc = await db
        .collection("users").doc(studentId)
        .collection("course_patterns").doc(courseId)
        .get();

      if (patternDoc.exists) {
        const pattern = patternDoc.data().pattern;
        if (counts[pattern] !== undefined) {
          counts[pattern]++;

          // Get all quiz results for this student in this course
          const quizSnap = await db
            .collection("users").doc(studentId)
            .collection("quiz_results")
            .where("courseId", "==", courseId)
            .get();

          if (!quizSnap.empty) {
            quizSnap.docs.forEach(doc => {
              const q = doc.data();
              if (q.total > 0) {
                scores[pattern].push((q.score / q.total) * 100);
              }
            });
          }
        }
      }
    }

    const calculateAverage = (arr) => arr.length === 0 ? 0 : (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1);

    const distribution = [
      {
        name: "Direct (Normal)",
        value: counts.direct,
        key: "direct",
        averageScore: parseFloat(calculateAverage(scores.direct))
      },
      {
        name: "Analogy",
        value: counts.analogy,
        key: "analogy",
        averageScore: parseFloat(calculateAverage(scores.analogy))
      },
      {
        name: "Interactive",
        value: counts.interactive,
        key: "interactive",
        averageScore: parseFloat(calculateAverage(scores.interactive))
      },
    ].filter(d => d.value > 0);

    res.json({
      distribution,
      totalAssessed: distribution.reduce((s, d) => s + d.value, 0),
      totalEnrolled: studentIds.length
    });
  } catch (err) {
    console.error("[Learning Styles Analytics] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── AI CHAT INTEGRATION ─────────────────────
const PYTHON_API_URL = "http://localhost:5001";

app.post("/ai/chat/stream", async (req, res) => {
  const { courseId, studentId, lectureIndex, question, outputMode, language } = req.body;

  try {
    if (!courseId || !studentId || lectureIndex === undefined || !question) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch Student Model (Level and Preference)
    const patternDoc = await db.collection("users").doc(studentId).collection("course_patterns").doc(courseId).get();
    let learningLevel = 3;
    let preferredMethod = outputMode || 'normal';

    if (patternDoc.exists) {
      const data = patternDoc.data();
      learningLevel = data.learningLevel || 3;
      if (!outputMode) {
        preferredMethod = data.pattern === 'direct' ? 'normal' : data.pattern;
      }
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) return res.status(404).json({ error: "Course not found" });

    const courseData = courseDoc.data();
    const lectures = courseData.lectures || [];
    if (lectureIndex >= lectures.length) return res.status(404).json({ error: "Lecture not found" });

    const lecture = lectures[lectureIndex];
    const pdfUrl = lecture.link;

    console.log(`[AI-Stream] Starting stream for ${studentId} on lecture ${lectureIndex}`);

    const pythonResponse = await axios.post(`${PYTHON_API_URL}/api/chat/stream`, {
      pdfUrl,
      question,
      outputMode: preferredMethod,
      learningLevel,
      language: language || "en"
    }, {
      responseType: 'stream',
      timeout: 300000
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    pythonResponse.data.pipe(res);

  } catch (err) {
    console.error("[AI-Stream] Error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

app.post("/ai/chat", async (req, res) => {
  const { courseId, studentId, lectureIndex, question, outputMode, language } = req.body;

  try {
    if (!courseId || !studentId || lectureIndex === undefined || !question) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch Student Model (Level and Preference)
    const patternDoc = await db.collection("users").doc(studentId).collection("course_patterns").doc(courseId).get();
    let learningLevel = 3;
    let preferredMethod = outputMode || 'normal'; // Prioritize manual override

    if (patternDoc.exists) {
      const data = patternDoc.data();
      learningLevel = data.learningLevel || 3;

      // If no manual override, use stored preference
      if (!outputMode) {
        preferredMethod = data.pattern === 'direct' ? 'normal' : data.pattern;
      }
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    const courseData = courseDoc.data();
    const lectures = courseData.lectures || [];

    if (lectureIndex >= lectures.length) {
      return res.status(404).json({ error: "Lecture not found" });
    }

    const lecture = lectures[lectureIndex];
    const pdfUrl = lecture.link;

    console.log(`[AI] Processing question for lecture: ${lecture.title}`);

    const pythonResponse = await axios.post(`${PYTHON_API_URL}/api/chat`, {
      pdfUrl,
      question,
      outputMode: preferredMethod,
      learningLevel,
      language: language || "en"
    }, {
      timeout: 300000 // 5 minute timeout for first-time initialization
    });

    res.json(pythonResponse.data);

  } catch (err) {
    console.error("[AI] Error:", err.message);

    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: "AI service unavailable. Please ensure Python API is running on port 5001."
      });
    }

    res.status(500).json({ error: err.message });
  }
});

app.post("/ai/mcq", async (req, res) => {
  const { courseId, lectureIndex, numQuestions } = req.body;

  try {
    if (!courseId || lectureIndex === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    const courseData = courseDoc.data();
    const lectures = courseData.lectures || [];

    if (lectureIndex >= lectures.length) {
      return res.status(404).json({ error: "Lecture not found" });
    }

    const lecture = lectures[lectureIndex];
    const pdfUrl = lecture.link;

    console.log(`[AI] Generating MCQs for lecture: ${lecture.title}`);

    const pythonResponse = await axios.post(`${PYTHON_API_URL}/api/mcq`, {
      pdfUrl,
      numQuestions: numQuestions || 3
    }, {
      timeout: 300000 // 5 minute timeout
    });

    res.json(pythonResponse.data);

  } catch (err) {
    console.error("[AI] MCQ Error:", err.message);

    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: "AI service unavailable. Please ensure Python API is running on port 5001."
      });
    }

    res.status(500).json({ error: err.message });
  }
});

app.get("/ai/audio/:filename", async (req, res) => {
  const { filename } = req.params;

  try {
    const audioResponse = await axios.get(`${PYTHON_API_URL}/audio/${filename}`, {
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    audioResponse.data.pipe(res);

  } catch (err) {
    console.error("[AI] Error serving audio:", err.message);
    res.status(404).json({ error: "Audio file not found" });
  }
});

// Fix: Proxy /audio/:filename for compatibility with Python API response
app.get("/audio/:filename", async (req, res) => {
  const { filename } = req.params;

  try {
    const audioResponse = await axios.get(`${PYTHON_API_URL}/audio/${filename}`, {
      responseType: 'stream'
    });

    // FORWARD HEADER for seeking/progress bar
    if (audioResponse.headers['content-length']) {
      res.setHeader('Content-Length', audioResponse.headers['content-length']);
    }
    if (audioResponse.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', audioResponse.headers['accept-ranges']);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    audioResponse.data.pipe(res);

  } catch (err) {
    console.error("[AI] Error serving audio:", err.message);
    res.status(404).json({ error: "Audio file not found" });
  }
});

app.post("/ai/mcq/save-score", async (req, res) => {
  const { studentId, courseId, lectureIndex, score, total, weakTopics } = req.body;

  try {
    if (!studentId || !courseId || lectureIndex === undefined || score === undefined || total === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.collection("users").doc(studentId).collection("quiz_results").add({
      courseId,
      lectureIndex,
      score,
      total,
      weakTopics: weakTopics || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // --- ADAPTIVE LEARNING LEVEL UPDATE ---
    const percentage = (score / total) * 100;
    const patternRef = db.collection("users").doc(studentId).collection("course_patterns").doc(courseId);
    const patternDoc = await patternRef.get();

    if (patternDoc.exists) {
      let currentLevel = patternDoc.data().learningLevel || 3;
      let newLevel = currentLevel;

      if (percentage < 40) {
        newLevel = Math.max(1, currentLevel - 1);
      } else if (percentage >= 70 && percentage < 85) {
        newLevel = Math.min(5, currentLevel + 1);
      } else if (percentage >= 85) {
        newLevel = Math.min(5, currentLevel + 2);
      }

      if (newLevel !== currentLevel) {
        console.log(`[Adaptive] Level updated for ${studentId}: ${currentLevel} -> ${newLevel} (score: ${percentage}%)`);
        await patternRef.update({ learningLevel: newLevel });
      }
    }

    res.json({ message: "Quiz score saved successfully" });
  } catch (err) {
    console.error("[Backend] Error saving quiz score:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/ai/mcq/analyze-performance", async (req, res) => {
  const { quizData, userAnswers } = req.body;

  try {
    const pythonResponse = await axios.post(`${PYTHON_API_URL}/api/mcq/analyze-performance`, {
      quizData,
      userAnswers
    }, {
      timeout: 300000 // 5 minute timeout
    });

    res.json(pythonResponse.data);
  } catch (err) {
    console.error("[AI] Analysis Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER ANALYTICS ───────────────────
app.get("/ai/analytics/lecture", async (req, res) => {
  const { courseId, lectureIndex } = req.query;

  try {
    if (!courseId || lectureIndex === undefined) {
      return res.status(400).json({ error: "courseId and lectureIndex are required" });
    }

    const lectureIdx = parseInt(lectureIndex, 10);

    // Get enrolled students
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) return res.status(404).json({ error: "Course not found" });
    const studentIds = courseDoc.data().students || [];

    if (studentIds.length === 0) {
      return res.json({ scoreDistribution: [], weakTopics: [], studentCount: 0 });
    }

    // For each student, get their LATEST quiz result for this lecture
    // We also fetch their learning pattern to group by method
    const latestResults = [];
    const styleGroups = { direct: [], analogy: [], interactive: [] };

    for (const studentId of studentIds) {
      // Get student basic pattern
      const patternDoc = await db
        .collection("users").doc(studentId)
        .collection("course_patterns").doc(courseId)
        .get();

      let pattern = 'direct'; // Default
      if (patternDoc.exists) {
        const p = patternDoc.data().pattern;
        if (p === 'analogy' || p === 'interactive' || p === 'direct') {
          pattern = p;
        }
      }

      const snap = await db
        .collection("users").doc(studentId)
        .collection("quiz_results")
        .where("courseId", "==", courseId)
        .get();

      if (!snap.empty) {
        // Filter to this lecture, sort latest first
        const filtered = snap.docs
          .map(d => d.data())
          .filter(d => d.lectureIndex === lectureIdx);

        if (filtered.length === 0) continue;

        // Sort in-memory by createdAt (latest first)
        filtered.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });

        const latest = filtered[0];
        latestResults.push(latest);

        // Add to style groups for average calculation
        // Ensure we handle potential null/zero total
        const total = latest.total || 5;
        const score = latest.score || 0;
        styleGroups[pattern].push((score / total) * 100);
      }
    }

    const calculateAvg = (arr) => arr.length === 0 ? 0 : parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1));

    const methodPerformance = [
      { name: "Direct (Normal)", value: calculateAvg(styleGroups.direct), key: "direct" },
      { name: "Analogy", value: calculateAvg(styleGroups.analogy), key: "analogy" },
      { name: "Interactive", value: calculateAvg(styleGroups.interactive), key: "interactive" },
    ]; // Always return all 3 for the chart to render consistently

    // Build score distribution: { score -> count }
    const scoreMap = {};
    // topicFailMap: normalized_key -> { displayName, count }
    const topicFailMap = {};

    // Helper: normalize a topic string for grouping
    // Strips common suffixes/prefixes and lowercases, so similar topics merge
    const normalizeTopic = (raw) => {
      return raw
        .toLowerCase()
        .trim()
        .replace(/\band\b/g, "&")                // "and" -> "&"
        .replace(/\b(basics?|fundamentals?|introduction to|overview of|concepts?|types? of|definition of)\b/gi, "")
        .replace(/[\s\-_]+/g, " ")               // collapse spaces/dashes
        .replace(/[^a-z0-9& ]/g, "")             // remove special chars
        .trim();
    };

    for (const result of latestResults) {
      const s = result.score ?? 0;
      scoreMap[s] = (scoreMap[s] || 0) + 1;

      // Aggregate and group weak topics
      const rawTopics = result.weakTopics || [];
      for (const topic of rawTopics) {
        if (!topic || !topic.trim()) continue;
        const displayName = topic.trim();
        const key = normalizeTopic(displayName);
        if (!key) continue;

        if (!topicFailMap[key]) {
          topicFailMap[key] = { displayName, count: 0 };
        }
        topicFailMap[key].count += 1;

        // Keep the longer, more descriptive display name
        if (displayName.length > topicFailMap[key].displayName.length) {
          topicFailMap[key].displayName = displayName;
        }
      }
    }

    // Determine max score from any result
    const maxScore = latestResults.length > 0
      ? Math.max(...latestResults.map(r => r.total || 0))
      : 0;

    // Build full score distribution from 0 to maxScore
    const scoreDistribution = [];
    for (let i = 0; i <= maxScore; i++) {
      scoreDistribution.push({ score: i, students: scoreMap[i] || 0 });
    }

    // Build sorted weak topics array (grouped by normalized key)
    const weakTopics = Object.values(topicFailMap)
      .map(({ displayName, count }) => ({ topic: displayName, count }))
      .sort((a, b) => b.count - a.count);

    console.log(`[Analytics] ${latestResults.length} students, ${weakTopics.length} weak topic groups`);

    res.json({
      scoreDistribution,
      weakTopics,
      methodPerformance,
      studentCount: latestResults.length,
      totalEnrolled: studentIds.length
    });

  } catch (err) {
    console.error("[Analytics] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/courses/:courseId/student-results", async (req, res) => {
  const { courseId } = req.params;
  const { lectureIndex } = req.query;
  const targetLectureIdx = lectureIndex !== undefined ? parseInt(lectureIndex, 10) : null;

  try {
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) return res.status(404).json({ error: "Course not found" });

    const studentIds = courseDoc.data().students || [];
    const results = [];

    for (const studentId of studentIds) {
      // Get student basic info
      const userDoc = await db.collection("users").doc(studentId).get();
      const userData = userDoc.data() || {};

      // Get learning level
      const patternDoc = await db
        .collection("users").doc(studentId)
        .collection("course_patterns").doc(courseId)
        .get();
      const currentLevel = patternDoc.exists ? (patternDoc.data().learningLevel || 3) : "Not Assessed";

      // Get quiz results for this course
      const quizSnap = await db
        .collection("users").doc(studentId)
        .collection("quiz_results")
        .where("courseId", "==", courseId)
        .get();

      let averageScore = "Not Attempted";
      let lectureScore = "Not Attempted";

      if (!quizSnap.empty) {
        const allQuizzes = quizSnap.docs.map(d => d.data());

        // Find score for the specific lecture if requested
        if (targetLectureIdx !== null) {
          const lectureQuizzes = allQuizzes
            .filter(q => Number(q.lectureIndex) === targetLectureIdx)
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

          if (lectureQuizzes.length > 0) {
            const latest = lectureQuizzes[0];
            lectureScore = ((latest.score / latest.total) * 100).toFixed(1) + "%";
          }
        }

        // Calculate course average (last 3 course-wide attempts)
        const sortedQuizzes = [...allQuizzes].sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });

        const lastThree = sortedQuizzes.slice(0, 3);
        const totalPercentage = lastThree.reduce((sum, q) => {
          const p = (q.score / q.total) * 100;
          return sum + p;
        }, 0);
        averageScore = (totalPercentage / lastThree.length).toFixed(1) + "%";
      }

      results.push({
        studentId,
        email: userData.email || "Unknown",
        averageScore,
        lectureScore,
        learningLevel: currentLevel
      });
    }

    res.json(results);
  } catch (err) {
    console.error("[Student Results] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────
app.get("/", (req, res) => {
  res.send("Backend running");
});

app.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});
