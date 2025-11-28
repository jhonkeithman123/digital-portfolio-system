import React from "react";
import { useParams } from "react-router-dom";
// reuse the QuizEditor that you added under Home/section-pages/quiz.jsx
import QuizEditor from "./quiz";

export default function CreateQuiz() {
  const { code } = useParams();
  return <QuizEditor classroomCode={code} />;
}