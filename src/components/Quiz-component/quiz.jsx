import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import useMessage from "../../hooks/useMessage.jsx";
import TokenGuard from "../auth/tokenGuard.jsx";
import { apiFetch } from "../../utils/apiClient.js";
import Header from "../Component-elements/Header";
import "./css/quiz.css";

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export default function QuizEditor({ classroomCode, initialData }) {
  const navigate = useNavigate();
  const { messageComponent, showMessage } = useMessage();
  const [isTrashOver, setIsTrashOver] = useState(false);
  const [, setDraggingType] = useState(null);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  // state
  const [title, setTitle] = useState(initialData?.title ?? "Untitled Quiz");
  const [pages, setPages] = useState(
    initialData?.pages ?? [{ id: uid("page-"), title: "Page 1", questions: [] }]
  );
  const [attemptsAllowed, setAttemptsAllowed] = useState(
    initialData?.attemptsAllowed ?? 1
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    initialData?.timeLimitSeconds
      ? String(Math.ceil(initialData.timeLimitSeconds / 60))
      : ""
  );

  const hydrated = useRef(false);
  const lastQuizId = useRef(initialData?.quizId ?? null);
  const showMsgRef = useRef(showMessage);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    // reset the hydration guard if we switched to a different quiz
    if ((initialData?.quizId ?? null) !== lastQuizId.current) {
      hydrated.current = false;
      lastQuizId.current = initialData?.quizId ?? null;
    }

    if (!initialData || hydrated.current) return;

    setTitle(initialData.title ?? "Untitled Quiz");
    setPages(
      initialData.pages ?? [
        { id: uid("page-"), title: "Page 1", questions: [] },
      ]
    );
    setAttemptsAllowed(initialData.attemptsAllowed ?? 1);
    setTimeLimitMinutes(
      initialData.timeLimitSeconds
        ? String(Math.ceil(initialData.timeLimitSeconds / 60))
        : ""
    );

    hydrated.current = true;
  }, [initialData]);

  function addPage() {
    setPages((p) => [
      ...p,
      { id: uid("page-"), title: `Page ${p.length + 1}`, questions: [] },
    ]);
  }
  function addQuestion(pageId, type = "multiple_choice") {
    setPages((p) =>
      p.map((pg) =>
        pg.id === pageId
          ? {
              ...pg,
              questions: [
                ...pg.questions,
                type === "multiple_choice"
                  ? {
                      id: uid("q-"),
                      type,
                      text: "New question",
                      options: ["", "", "", ""],
                      correctAnswer: null,
                    }
                  : type === "checkboxes"
                  ? {
                      id: uid("q-"),
                      type,
                      text: "New question",
                      options: ["", "", "", ""],
                      correctAnswer: [],
                    }
                  : type === "short_answer"
                  ? {
                      id: uid("q-"),
                      type,
                      text: "New question",
                      sentenceLimit: 1,
                      correctAnswer: "",
                    }
                  : {
                      id: uid("q-"),
                      type: "paragraph",
                      text: "New question",
                      sentenceLimit: 3,
                      correctAnswer: "",
                    },
              ],
            }
          : pg
      )
    );
  }
  function updateQuestion(pageId, qId, patch) {
    setPages((p) =>
      p.map((pg) =>
        pg.id === pageId
          ? {
              ...pg,
              questions: pg.questions.map((q) =>
                q.id === qId ? { ...q, ...patch } : q
              ),
            }
          : pg
      )
    );
  }

  // Map old option indices to new indices after reordering within a question
  function reorderOptionWithCorrect(length, from, to, correct) {
    // build mapping oldIndex -> newIndex
    const map = new Map();
    for (let i = 0; i < length; i++) map.set(i, i);
    if (from < to) {
      for (let i = from + 1; i <= to; i++) map.set(i, i - 1);
      map.set(from, to);
    } else if (from > to) {
      for (let i = to; i < from; i++) map.set(i, i + 1);
      map.set(from, to);
    }
    if (correct == null) return correct;

    // handle MC (string index) or checkbox (array)
    if (Array.isArray(correct)) {
      return correct.map((i) => map.get(i)).sort((a, b) => a - b);
    } else {
      const c = parseInt(correct, 10);
      if (Number.isNaN(c)) return correct;
      return String(map.get(c));
    }
  }

  // Determine what kind of thing is being dragged from its source list
  function getDragKind(srcDroppableId) {
    if (srcDroppableId === "pages") return "PAGE";
    if (srcDroppableId.includes("__opts")) return "OPTION";
    return "QUESTION";
  }
  function parseOptDroppableId(id) {
    // format: pageId__questionId__opts
    const [pageId, qId] = id.split("__");
    return { pageId, qId };
  }
  function onDragEnd(result) {
    const { source, destination } = result;
    // Reset highlight immediately, but delay type reset so DnD can finish cleanly
    setIsTrashOver(false);
    requestAnimationFrame(() => setDraggingType(null));
    if (!destination) return;

    const kind = getDragKind(source.droppableId);

    // Delete if dropped on trash
    if (destination.droppableId === "trash") {
      if (kind === "PAGE") {
        removePage(source.index);
      } else if (kind === "QUESTION") {
        const srcPageId = source.droppableId;
        removeQuestion(srcPageId, source.index);
      } else if (kind === "OPTION") {
        const { pageId, qId } = parseOptDroppableId(source.droppableId);
        removeOption(pageId, qId, source.index);
      }
      return;
    }

    // Handle moves per kind (ignore invalid destinations)
    if (kind === "PAGE") {
      if (destination.droppableId !== "pages") return;
      const next = Array.from(pages);
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      setPages(next);
      return;
    }

    if (kind === "QUESTION") {
      const srcPageIdx = pages.findIndex((p) => p.id === source.droppableId);
      const dstPageIdx = pages.findIndex(
        (p) => p.id === destination.droppableId
      );
      if (srcPageIdx < 0 || dstPageIdx < 0) return;

      const srcPage = { ...pages[srcPageIdx] };
      const dstPage =
        srcPageIdx === dstPageIdx ? srcPage : { ...pages[dstPageIdx] };

      const srcQs = Array.from(srcPage.questions);
      const [movedQ] = srcQs.splice(source.index, 1);

      if (srcPageIdx === dstPageIdx) {
        srcQs.splice(destination.index, 0, movedQ);
        const next = [...pages];
        next[srcPageIdx] = { ...srcPage, questions: srcQs };
        setPages(next);
      } else {
        const dstQs = Array.from(dstPage.questions);
        dstQs.splice(destination.index, 0, movedQ);
        const next = [...pages];
        next[srcPageIdx] = { ...srcPage, questions: srcQs };
        next[dstPageIdx] = { ...dstPage, questions: dstQs };
        setPages(next);
      }
      return;
    }

    if (kind === "OPTION") {
      const srcInfo = parseOptDroppableId(source.droppableId);
      const dstInfo = parseOptDroppableId(destination.droppableId);
      if (srcInfo.pageId !== dstInfo.pageId || srcInfo.qId !== dstInfo.qId)
        return;

      setPages((prev) =>
        prev.map((pg) => {
          if (pg.id !== srcInfo.pageId) return pg;
          return {
            ...pg,
            questions: pg.questions.map((q) => {
              if (q.id !== srcInfo.qId) return q;
              const opts = Array.from(q.options || []);
              const [moved] = opts.splice(source.index, 1);
              opts.splice(destination.index, 0, moved);

              const newCorrect = reorderOptionWithCorrect(
                opts.length,
                source.index,
                destination.index,
                q.correctAnswer
              );
              return { ...q, options: opts, correctAnswer: newCorrect };
            }),
          };
        })
      );
      return;
    }
  }
  // helper for live highlight while aiming the trash
  function onDragUpdate(update) {
    const dest = update?.destination;
    setIsTrashOver(!!dest && dest.droppableId === "trash");
  }
  const onDragStart = (start) => {
    setDraggingType(getDragKind(start.source.droppableId));
  };

  // Helpers to remove items
  function removePage(pageIndex) {
    setPages((p) => p.filter((_, i) => i !== pageIndex));
  }
  function removeQuestion(pageId, qIndex) {
    setPages((p) =>
      p.map((pg) =>
        pg.id !== pageId
          ? pg
          : { ...pg, questions: pg.questions.filter((_, i) => i !== qIndex) }
      )
    );
  }
  function removeOption(pageId, qId, optIndex) {
    setPages((p) =>
      p.map((pg) => {
        if (pg.id !== pageId) return pg;
        return {
          ...pg,
          questions: pg.questions.map((q) => {
            if (q.id !== qId || !Array.isArray(q.options)) return q;
            const opts = [...q.options];
            opts.splice(optIndex, 1);

            const patch = { options: opts };
            if (q.type === "multiple_choice") {
              const cur =
                q.correctAnswer == null ? null : parseInt(q.correctAnswer, 10);
              if (cur == null || Number.isNaN(cur)) {
                // nothing
              } else if (cur === optIndex) {
                patch.correctAnswer = null;
              } else if (cur > optIndex) {
                patch.correctAnswer = String(cur - 1);
              }
            } else if (q.type === "checkboxes") {
              const arr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
              patch.correctAnswer = arr
                .filter((i) => i !== optIndex)
                .map((i) => (i > optIndex ? i - 1 : i));
            }
            return { ...q, ...patch };
          }),
        };
      })
    );
  }

  async function saveQuiz() {
    if (!classroomCode)
      return showMsgRef.current("No classroom selected", "error");

    const attempts = Math.max(1, parseInt(attemptsAllowed || 1, 10));
    const mins = parseInt(timeLimitMinutes, 10);
    const timeLimitSeconds =
      Number.isFinite(mins) && mins > 0 ? mins * 60 : null;

    const payload = {
      title,
      questions: { pages }, // preserve pages
      attemptsAllowed: attempts,
      startTime: null,
      endTime: null,
      timeLimitSeconds,
    };

    const isEdit = !!initialData?.quizId;
    const url = isEdit
      ? `/quizzes/${classroomCode}/quizzes/${initialData.quizId}`
      : `/quizzes/${classroomCode}/quizzes/create`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const { unauthorized, data } = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in again.", "error");
        navigate("/login");
        return;
      }
      if (!data.success) {
        showMsgRef.current(data.message || "Save failed", "error");
        return;
      }
      showMsgRef.current(isEdit ? "Quiz updated" : "Quiz created", "success");
      // optionally go back to list
      // navigate(`/quizzes/${classroomCode}/quizzes`);
    } catch (err) {
      console.error("Error saving quiz", err);
      showMsgRef.current("Server error saving quiz", "error");
    }
  }

  function changeQuestionType(pageId, qId, nextType) {
    setPages((prev) =>
      prev.map((pg) => {
        if (pg.id !== pageId) return pg;
        return {
          ...pg,
          questions: pg.questions.map((q) => {
            if (q.id !== qId) return q;

            const text = (q.text ?? "").toString();

            if (nextType === "multiple_choice") {
              const opts =
                Array.isArray(q.options) && q.options.length
                  ? q.options.map(String)
                  : ["", "", "", ""];
              const idx = q.type === "multiple_choice" ? q.correctAnswer : null;
              const correct =
                idx != null &&
                !Number.isNaN(parseInt(idx, 10)) &&
                parseInt(idx, 10) < opts.length
                  ? String(parseInt(idx, 10))
                  : null;
              return {
                id: q.id,
                type: "multiple_choice",
                text,
                options: opts,
                correctAnswer: correct,
              };
            } else if (nextType === "checkboxes") {
              const opts =
                Array.isArray(q.options) && q.options.length
                  ? q.options.map(String)
                  : ["", "", "", ""];
              const arr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
              const clean = Array.from(
                new Set(
                  arr.filter(
                    (i) => Number.isInteger(i) && i >= 0 && i < opts.length
                  )
                )
              ).sort((a, b) => a - b);
              return {
                id: q.id,
                type: "checkboxes",
                text,
                options: opts,
                correctAnswer: clean,
              };
            } else if (nextType === "short_answer") {
              // Force default 1 and clamp later via input handler
              return {
                id: q.id,
                type: "short_answer",
                text,
                sentenceLimit: 1,
                correctAnswer: String(q.correctAnswer ?? ""),
              };
            } else if (nextType === "paragraph") {
              const n = parseInt(q.sentenceLimit, 10);
              const sentenceLimit = Number.isFinite(n) ? Math.max(3, n) : 3;
              return {
                id: q.id,
                type: "paragraph",
                text,
                sentenceLimit,
                correctAnswer: String(q.correctAnswer ?? ""),
              };
            }
            // If an unexpected value sneaks in, keep current question unchanged.
            return q;
          }),
        };
      })
    );
  }

  const roleClass = user?.role === "teacher" ? "teacher-role" : "student-role";

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in", "error")
      }
    >
      <Header
        variant="authed"
        user={user}
        headerClass={`quiz-header ${roleClass}`}
        welcomeClass={`quiz-welcome ${roleClass}`}
      />
      {messageComponent}

      <div className="quiz-editor-shell">
        <div className="quiz-editor-card">
          <div className="qe-tools">
            <div className="q-header" style={{ alignItems: "center" }}>
              <div className="quiz-title-wrap">
                <input
                  className="qe-input quiz-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  placeholder="Enter the title of your quiz"
                  aria-label="Quiz title"
                />
                <div
                  className="quiz-subtitle"
                  style={{ marginTop: 6, fontSize: 13 }}
                >
                  Quiz editor — drag pages and questions to reorder
                </div>
              </div>

              <div className="quiz-controls">
                <div className="qc-actions">
                  <button
                    className="quiz-action-btn back"
                    onClick={() => navigate("/home")}
                  >
                    ← Back to Home
                  </button>
                </div>
                <label className="qc-field">
                  <span className="qc-label">Attempts</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="qe-input qc-number"
                    value={attemptsAllowed}
                    onChange={(e) => setAttemptsAllowed(e.target.value)}
                  />
                </label>
                <label className="qc-field">
                  <span className="qc-label">Time limit</span>
                  <div className="qc-time">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="qe-input qc-number"
                      placeholder="mins"
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(e.target.value)}
                    />
                    <span className="qc-suffix">min</span>
                  </div>
                </label>

                <div className="qc-actions">
                  <button
                    className="quiz-button"
                    onClick={addPage}
                    type="button"
                  >
                    + Page
                  </button>
                  <button
                    className="quiz-button"
                    onClick={() => addQuestion(pages[0].id)}
                  >
                    + Question
                  </button>
                  <button className="quiz-action-btn view" onClick={saveQuiz}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
          <section className="quiz-card">
            <div className="qe-editor">
              <DragDropContext
                onDragEnd={onDragEnd}
                onDragUpdate={onDragUpdate}
                onDragStart={onDragStart}
              >
                <div className={`trash-zone ${isTrashOver ? "over" : ""}`}>
                  {/* Single, always-mounted trash; accepts all items via type="ITEM" */}
                  <Droppable droppableId="trash" type="ITEM">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`trash-drop visible ${
                          snapshot.isDraggingOver ? "over" : ""
                        }`}
                      >
                        <span className="trash-content">
                          <span className="trash-icon" aria-hidden>
                            🗑
                          </span>
                          <span className="trash-text">
                            {snapshot.isDraggingOver
                              ? "Release to delete"
                              : "Drag here to delete"}
                          </span>
                        </span>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
                {/* Make pages list also type="ITEM" so it can drop to the universal trash */}
                <Droppable droppableId="pages" type="ITEM" direction="vertical">
                  {(provided) => (
                    <div className="pages-scroll">
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="qe-pages"
                      >
                        {pages.map((pg, idx) => (
                          <Draggable
                            draggableId={pg.id}
                            index={idx}
                            key={pg.id}
                          >
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className="page-card"
                                style={dragProvided.draggableProps.style}
                              >
                                <div className="page-header">
                                  <input
                                    className="qe-input page-title"
                                    value={pg.title}
                                    onChange={(e) =>
                                      setPages((p) =>
                                        p.map((x) =>
                                          x.id === pg.id
                                            ? { ...x, title: e.target.value }
                                            : x
                                        )
                                      )
                                    }
                                  />
                                  <div className="page-controls">
                                    <button
                                      className="qe-btn"
                                      onClick={() => addQuestion(pg.id)}
                                    >
                                      +Q
                                    </button>
                                  </div>
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="drag-handle"
                                    aria-hidden
                                  >
                                    ☰
                                  </div>
                                </div>

                                <Droppable
                                  droppableId={pg.id}
                                  type="ITEM"
                                  direction="vertical"
                                  ignoreContainerClipping={true}
                                >
                                  {(qProvided) => (
                                    <div
                                      ref={qProvided.innerRef}
                                      {...qProvided.droppableProps}
                                      className="question-list"
                                    >
                                      {pg.questions.map((q, qidx) => (
                                        <Draggable
                                          draggableId={q.id}
                                          index={qidx}
                                          key={q.id}
                                        >
                                          {(qi) => (
                                            <div
                                              ref={qi.innerRef}
                                              {...qi.draggableProps}
                                              className="question-card"
                                              style={qi.draggableProps.style}
                                            >
                                              <div className="question-top">
                                                <div
                                                  {...qi.dragHandleProps}
                                                  className="drag-handle"
                                                >
                                                  ☰
                                                </div>
                                                <input
                                                  className="qe-input qe-question-text"
                                                  value={q.text}
                                                  onChange={(e) =>
                                                    updateQuestion(
                                                      pg.id,
                                                      q.id,
                                                      {
                                                        text: e.target.value,
                                                      }
                                                    )
                                                  }
                                                />
                                                <select
                                                  className="qe-select"
                                                  value={q.type}
                                                  onChange={(e) =>
                                                    changeQuestionType(
                                                      pg.id,
                                                      q.id,
                                                      e.target.value
                                                    )
                                                  }
                                                >
                                                  <option value="multiple_choice">
                                                    Multiple choice
                                                  </option>
                                                  <option value="short_answer">
                                                    Short answer
                                                  </option>
                                                  <option value="paragraph">
                                                    Paragraph
                                                  </option>
                                                  <option value="checkboxes">
                                                    Checkboxes
                                                  </option>
                                                </select>
                                              </div>

                                              {(q.type === "multiple_choice" ||
                                                q.type === "checkboxes") && (
                                                <>
                                                  <div className="qa-label">
                                                    Options
                                                  </div>

                                                  <Droppable
                                                    droppableId={`${pg.id}__${q.id}__opts`}
                                                    type="ITEM"
                                                    direction="vertical"
                                                    ignoreContainerClipping={
                                                      true
                                                    }
                                                  >
                                                    {(optsProvided) => (
                                                      <div
                                                        ref={
                                                          optsProvided.innerRef
                                                        }
                                                        {...optsProvided.droppableProps}
                                                        className="options"
                                                      >
                                                        {(q.options || []).map(
                                                          (opt, oi) => {
                                                            const isCb =
                                                              q.type ===
                                                              "checkboxes";
                                                            const isCorrect =
                                                              q.type ===
                                                              "multiple_choice"
                                                                ? String(oi) ===
                                                                  String(
                                                                    q.correctAnswer ??
                                                                      ""
                                                                  )
                                                                : Array.isArray(
                                                                    q.correctAnswer
                                                                  ) &&
                                                                  q.correctAnswer.includes(
                                                                    oi
                                                                  );

                                                            return (
                                                              <Draggable
                                                                draggableId={`${q.id}-opt-${oi}`}
                                                                index={oi}
                                                                key={`${q.id}-opt-${oi}`}
                                                              >
                                                                {(od) => (
                                                                  <div
                                                                    ref={
                                                                      od.innerRef
                                                                    }
                                                                    {...od.draggableProps}
                                                                    className="opt-row"
                                                                    style={
                                                                      od
                                                                        .draggableProps
                                                                        .style
                                                                    }
                                                                  >
                                                                    <div
                                                                      {...od.dragHandleProps}
                                                                      className="drag-handle"
                                                                    >
                                                                      ☰
                                                                    </div>
                                                                    <input
                                                                      className="qe-input"
                                                                      value={
                                                                        opt
                                                                      }
                                                                      placeholder={`Option ${
                                                                        oi + 1
                                                                      }`}
                                                                      onChange={(
                                                                        e
                                                                      ) => {
                                                                        const opts =
                                                                          [
                                                                            ...(q.options ||
                                                                              []),
                                                                          ];
                                                                        opts[
                                                                          oi
                                                                        ] =
                                                                          e.target.value;
                                                                        updateQuestion(
                                                                          pg.id,
                                                                          q.id,
                                                                          {
                                                                            options:
                                                                              opts,
                                                                          }
                                                                        );
                                                                      }}
                                                                    />
                                                                    {isCb ? (
                                                                      <label className="opt-correct">
                                                                        <input
                                                                          type="checkbox"
                                                                          checked={
                                                                            isCorrect
                                                                          }
                                                                          onChange={() => {
                                                                            const arr =
                                                                              Array.isArray(
                                                                                q.correctAnswer
                                                                              )
                                                                                ? [
                                                                                    ...q.correctAnswer,
                                                                                  ]
                                                                                : [];
                                                                            const idx =
                                                                              arr.indexOf(
                                                                                oi
                                                                              );
                                                                            if (
                                                                              idx >=
                                                                              0
                                                                            )
                                                                              arr.splice(
                                                                                idx,
                                                                                1
                                                                              );
                                                                            else
                                                                              arr.push(
                                                                                oi
                                                                              );
                                                                            updateQuestion(
                                                                              pg.id,
                                                                              q.id,
                                                                              {
                                                                                correctAnswer:
                                                                                  arr,
                                                                              }
                                                                            );
                                                                          }}
                                                                        />
                                                                        Correct
                                                                      </label>
                                                                    ) : (
                                                                      <button
                                                                        className={`qe-btn small${
                                                                          isCorrect
                                                                            ? " active"
                                                                            : ""
                                                                        }`}
                                                                        title="Mark as correct"
                                                                        onClick={() =>
                                                                          updateQuestion(
                                                                            pg.id,
                                                                            q.id,
                                                                            {
                                                                              correctAnswer:
                                                                                String(
                                                                                  oi
                                                                                ),
                                                                            }
                                                                          )
                                                                        }
                                                                      >
                                                                        ✓
                                                                      </button>
                                                                    )}

                                                                    <button
                                                                      className="qe-btn small danger"
                                                                      aria-label="Remove option"
                                                                      onClick={() =>
                                                                        removeOption(
                                                                          pg.id,
                                                                          q.id,
                                                                          oi
                                                                        )
                                                                      }
                                                                    >
                                                                      🗑
                                                                    </button>
                                                                  </div>
                                                                )}
                                                              </Draggable>
                                                            );
                                                          }
                                                        )}
                                                        {
                                                          optsProvided.placeholder
                                                        }

                                                        <button
                                                          className="qe-btn ghost"
                                                          onClick={() =>
                                                            updateQuestion(
                                                              pg.id,
                                                              q.id,
                                                              {
                                                                options: [
                                                                  ...(q.options ||
                                                                    []),
                                                                  "",
                                                                ],
                                                              }
                                                            )
                                                          }
                                                        >
                                                          + Option
                                                        </button>
                                                      </div>
                                                    )}
                                                  </Droppable>
                                                </>
                                              )}

                                              {q.type === "short_answer" && (
                                                <div className="qa-section">
                                                  <div className="qa-label">
                                                    Answer
                                                  </div>
                                                  <input
                                                    className="qe-input"
                                                    placeholder="Correct short answer"
                                                    value={
                                                      q.correctAnswer || ""
                                                    }
                                                    onChange={(e) =>
                                                      updateQuestion(
                                                        pg.id,
                                                        q.id,
                                                        {
                                                          correctAnswer:
                                                            e.target.value,
                                                        }
                                                      )
                                                    }
                                                  />
                                                  <label className="qa-inline">
                                                    <span>
                                                      Sentences allowed
                                                    </span>
                                                    <input
                                                      type="number"
                                                      min={1}
                                                      max={3}
                                                      className="qe-input qa-number"
                                                      // allow free typing; keep empty string if user clears
                                                      value={
                                                        q.sentenceLimit ===
                                                          "" ||
                                                        q.sentenceLimit == null
                                                          ? ""
                                                          : String(
                                                              q.sentenceLimit
                                                            )
                                                      }
                                                      onChange={(e) => {
                                                        // store raw string, don't clamp per key
                                                        updateQuestion(
                                                          pg.id,
                                                          q.id,
                                                          {
                                                            sentenceLimit:
                                                              e.target.value,
                                                          }
                                                        );
                                                      }}
                                                      onBlur={(e) => {
                                                        // clamp on commit (blur)
                                                        const n = parseInt(
                                                          e.target.value,
                                                          10
                                                        );
                                                        const v =
                                                          Number.isFinite(n)
                                                            ? Math.min(
                                                                3,
                                                                Math.max(1, n)
                                                              )
                                                            : 1;
                                                        updateQuestion(
                                                          pg.id,
                                                          q.id,
                                                          {
                                                            sentenceLimit: v,
                                                          }
                                                        );
                                                      }}
                                                    />
                                                  </label>
                                                </div>
                                              )}

                                              {q.type === "paragraph" && (
                                                <div className="qa-section">
                                                  <div className="qa-label">
                                                    Answer
                                                  </div>
                                                  <textarea
                                                    className="qe-input"
                                                    rows={3}
                                                    placeholder="Expected answer or rubric (optional)"
                                                    value={
                                                      q.correctAnswer || ""
                                                    }
                                                    onChange={(e) =>
                                                      updateQuestion(
                                                        pg.id,
                                                        q.id,
                                                        {
                                                          correctAnswer:
                                                            e.target.value,
                                                        }
                                                      )
                                                    }
                                                  />
                                                  <label className="qa-inline">
                                                    <span>
                                                      Sentences required
                                                    </span>
                                                    <input
                                                      type="number"
                                                      min={3}
                                                      className="qe-input qa-number"
                                                      value={
                                                        q.sentenceLimit ===
                                                          "" ||
                                                        q.sentenceLimit == null
                                                          ? ""
                                                          : String(
                                                              q.sentenceLimit
                                                            )
                                                      }
                                                      onChange={(e) => {
                                                        updateQuestion(
                                                          pg.id,
                                                          q.id,
                                                          {
                                                            sentenceLimit:
                                                              e.target.value,
                                                          }
                                                        );
                                                      }}
                                                      onBlur={(e) => {
                                                        const n = parseInt(
                                                          e.target.value,
                                                          10
                                                        );
                                                        const v =
                                                          Number.isFinite(n)
                                                            ? Math.max(3, n)
                                                            : 3;
                                                        updateQuestion(
                                                          pg.id,
                                                          q.id,
                                                          {
                                                            sentenceLimit: v,
                                                          }
                                                        );
                                                      }}
                                                    />
                                                  </label>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {qProvided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </section>
        </div>
      </div>
    </TokenGuard>
  );
}
