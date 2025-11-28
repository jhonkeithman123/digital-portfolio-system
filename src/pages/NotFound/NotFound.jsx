import { useNavigate } from "react-router-dom";
import Header from "../../components/Component-elements/Header";
import "./NotFound.css";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <>
      <Header subtitle="Can't find the page you are looking for" />
      <main className="nf-root" role="main">
        <section className="nf-card" aria-labelledby="nf-title">
          <div className="nf-illustration" aria-hidden="true">
            <svg
              width="120"
              height="120"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0" stopColor="#60a5fa" />
                  <stop offset="1" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <rect
                rx="4"
                width="24"
                height="24"
                fill="url(#g1)"
                opacity="0.12"
              />
              <path
                d="M7 7 L17 17 M17 7 L7 17"
                stroke="#7c3aed"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 id="nf-title" className="notFound">
            404 — Page not found
          </h1>

          <p className="notFoundP">
            Oops — we can't find the page you're looking for. It may have been
            moved or removed.
          </p>

          <div className="nf-actions">
            <button onClick={() => navigate("/")} className="buttonN primary">
              Go home
            </button>
            <button onClick={() => navigate(-1)} className="buttonN ghost">
              Go back
            </button>
          </div>

          <small className="nf-foot">
            If you think this is an error, contact your administrator.
          </small>
        </section>
      </main>
    </>
  );
};

export default NotFound;
