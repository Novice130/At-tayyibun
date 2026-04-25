"use client";

// Sentry temporarily disabled.
// import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "50px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <h1>Sentry Example Page</h1>
      <p>Sentry is currently disabled.</p>
      {/*
      <button
        type="button"
        style={{
          padding: "12px 24px",
          background: "#635bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "16px"
        }}
        onClick={() => {
          Sentry.captureException(new Error("Sentry Test Error"));
          alert("Error captured! Check your Sentry dashboard.");
          throw new Error("Sentry Test Error");
        }}
      >
        Throw Test Error
      </button>
      */}
    </div>
  );
}
