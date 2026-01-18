import { Router } from "express";
import { db } from "../db";
import { tallies, otherTallies, tallyHistory, classReasons, performanceReasons } from "../../shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { student_id } = req.query;
    
    if (student_id) {
      const result = await db.select().from(tallies).where(eq(tallies.studentId, student_id as string));
      return res.json(result);
    }

    const result = await db.select().from(tallies);
    res.json(result);
  } catch (error) {
    console.error("Error fetching tallies:", error);
    res.status(500).json({ error: "Failed to fetch tallies" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { student_id, count, reason, type, mentor_short_form, class: className } = req.body;

    if (!student_id || count === undefined) {
      return res.status(400).json({ error: "Student ID and count are required" });
    }

    const existingTally = await db.select().from(tallies).where(eq(tallies.studentId, student_id));

    let result;
    if (existingTally.length > 0) {
      const [updated] = await db.update(tallies)
        .set({
          count: sql`${tallies.count} + ${count}`,
          fineAmount: sql`(${tallies.count} + ${count}) * 10`,
          updatedAt: new Date(),
        })
        .where(eq(tallies.studentId, student_id))
        .returning();
      result = updated;
    } else {
      const [newTally] = await db.insert(tallies).values({
        studentId: student_id,
        count,
        fineAmount: String(count * 10),
        addedBy: req.session.mentorId,
      }).returning();
      result = newTally;
    }

    if (reason && className && mentor_short_form) {
      await db.insert(tallyHistory).values({
        studentId: student_id,
        class: className,
        mentorId: req.session.mentorId,
        mentorShortForm: mentor_short_form,
        type: type || 'class',
        reason,
        tallyValue: count,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error creating tally:", error);
    res.status(500).json({ error: "Failed to create tally" });
  }
});

router.get("/other", async (req, res) => {
  try {
    const { student_id } = req.query;
    
    if (student_id) {
      const result = await db.select().from(otherTallies).where(eq(otherTallies.studentId, student_id as string));
      return res.json(result);
    }

    const result = await db.select().from(otherTallies);
    res.json(result);
  } catch (error) {
    console.error("Error fetching other tallies:", error);
    res.status(500).json({ error: "Failed to fetch other tallies" });
  }
});

router.post("/other", async (req, res) => {
  try {
    const { student_id, count, reason, mentor_short_form, class: className } = req.body;

    if (!student_id || count === undefined) {
      return res.status(400).json({ error: "Student ID and count are required" });
    }

    const existingTally = await db.select().from(otherTallies).where(eq(otherTallies.studentId, student_id));

    let result;
    if (existingTally.length > 0) {
      const [updated] = await db.update(otherTallies)
        .set({
          count: sql`${otherTallies.count} + ${count}`,
          fineAmount: sql`(${otherTallies.count} + ${count}) * 10`,
          updatedAt: new Date(),
        })
        .where(eq(otherTallies.studentId, student_id))
        .returning();
      result = updated;
    } else {
      const [newTally] = await db.insert(otherTallies).values({
        studentId: student_id,
        count,
        fineAmount: String(count * 10),
        addedBy: req.session.mentorId,
      }).returning();
      result = newTally;
    }

    if (reason && className && mentor_short_form) {
      await db.insert(tallyHistory).values({
        studentId: student_id,
        class: className,
        mentorId: req.session.mentorId,
        mentorShortForm: mentor_short_form,
        type: 'performance',
        reason,
        tallyValue: count,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error creating other tally:", error);
    res.status(500).json({ error: "Failed to create other tally" });
  }
});

router.get("/reasons/class", async (req, res) => {
  try {
    const result = await db.select().from(classReasons);
    res.json(result);
  } catch (error) {
    console.error("Error fetching class reasons:", error);
    res.status(500).json({ error: "Failed to fetch class reasons" });
  }
});

router.get("/reasons/performance", async (req, res) => {
  try {
    const result = await db.select().from(performanceReasons);
    res.json(result);
  } catch (error) {
    console.error("Error fetching performance reasons:", error);
    res.status(500).json({ error: "Failed to fetch performance reasons" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const { student_id, start_date, end_date, class: className } = req.query;
    
    const conditions = [];
    if (student_id) conditions.push(eq(tallyHistory.studentId, student_id as string));
    if (className) conditions.push(eq(tallyHistory.class, className as string));
    if (start_date) conditions.push(gte(tallyHistory.createdAt, new Date(start_date as string)));
    if (end_date) {
      const end = new Date(end_date as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(tallyHistory.createdAt, end));
    }
    
    const result = await db.select().from(tallyHistory).where(and(...(conditions as any[])));
    res.json(result);
  } catch (error) {
    console.error("Error fetching tally history:", error);
    res.status(500).json({ error: "Failed to fetch tally history" });
  }
});

router.get("/history/summary", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const conditions = [];
    if (start_date) conditions.push(gte(tallyHistory.createdAt, new Date(start_date as string)));
    if (end_date) {
      const end = new Date(end_date as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(tallyHistory.createdAt, end));
    }

    const result = await db.select({
      class: tallyHistory.class,
      type: tallyHistory.type,
      totalValue: sql<number>`SUM(${tallyHistory.tallyValue})`
    })
    .from(tallyHistory)
    .where(and(...(conditions as any[])))
    .groupBy(tallyHistory.class, tallyHistory.type);

    res.json(result);
  } catch (error) {
    console.error("Error fetching history summary:", error);
    res.status(500).json({ error: "Failed to fetch history summary" });
  }
});

export default router;
