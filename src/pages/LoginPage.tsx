import { useState } from "react"

type LoginPageProps = {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState("")

  const isSignUp = mode === "signup"

  function changeMode(newMode: "login" | "signup") {
    setMode(newMode)
    setError("")
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    // =========================
    // SIGN UP
    // =========================
    if (isSignUp) {
      if (!name.trim()) {
        setError("Please enter your name")
        return
      }

      if (!email.trim()) {
        setError("Please enter your email")
        return
      }

      if (!email.includes("@")) {
        setError("Please enter a valid email")
        return
      }

      if (!password) {
        setError("Please enter your password")
        return
      }

      if (password.length < 6) {
        setError("Password must contain at least 6 characters")
        return
      }

      // Account created successfully
      alert("Account created successfully! Please sign in.")

      // Go back to Sign In
      setMode("login")

      // Keep email so user doesn't need to type it again
      setPassword("")
      setError("")

      return
    }

    // =========================
    // LOGIN
    // =========================
    if (!email.trim()) {
      setError("Please enter your email")
      return
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email")
      return
    }

    if (!password) {
      setError("Please enter your password")
      return
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters")
      return
    }

    // =========================
    // SUCCESSFUL LOGIN
    // =========================
    onLogin()
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100dvh",
        background: "#eaf5f1",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* PHONE SCREEN */}
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          minHeight: "100dvh",
          background: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* =========================
            GREEN HEADER
        ========================= */}
        <div
          style={{
            background:
              "linear-gradient(145deg, #08a879 0%, #08a477 55%, #008f78 100%)",
            color: "white",
            padding: "24px 22px 38px",
          }}
        >
          {/* TOP LOGO */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                🛍️
              </div>

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                CampusBites
              </span>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.16)",
                padding: "6px 10px",
                borderRadius: "20px",
                fontSize: "9px",
                fontWeight: "600",
              }}
            >
              Campus Canteen
            </div>
          </div>

          {/* HERO TEXT */}
          <div style={{ marginTop: "28px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "27px",
                lineHeight: "29px",
                fontWeight: "800",
              }}
            >
              Skip the Queue.
              <br />
              <span style={{ color: "#b8f5df" }}>Savor the Moment.</span>
            </h1>

            <p
              style={{
                margin: "10px 0 0",
                fontSize: "11px",
                lineHeight: "16px",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Order from any counter, pay your way,
              <br />
              and pick up when it's hot & ready.
            </p>
          </div>
        </div>

        {/* =========================
            WHITE FORM AREA
        ========================= */}
        <div
          style={{
            flex: 1,
            marginTop: "-18px",
            background: "#ffffff",
            borderRadius: "26px 26px 0 0",
            position: "relative",
            zIndex: 2,
            padding: "18px 20px 24px",
            boxSizing: "border-box",
          }}
        >
          {/* =========================
              SIGN IN / SIGN UP
          ========================= */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {/* SIGN IN */}
            <button
              type="button"
              onClick={() => changeMode("login")}
              style={{
                flex: 1,
                height: "42px",
                border: "none",
                borderRadius: "11px",
                background: mode === "login" ? "#078f69" : "#08a879",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 3px 8px rgba(0,120,90,0.18)",
              }}
            >
              Sign In
            </button>

            {/* SIGN UP */}
            <button
              type="button"
              onClick={() => changeMode("signup")}
              style={{
                flex: 1,
                height: "42px",
                border: "none",
                borderRadius: "11px",
                background: mode === "signup" ? "#078f69" : "#08a879",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 3px 8px rgba(0,120,90,0.18)",
              }}
            >
              Sign Up
            </button>
          </div>

          {/* =========================
              TITLE
          ========================= */}
          <div style={{ marginBottom: "18px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "21px",
                lineHeight: "26px",
                fontWeight: "800",
                color: "#17202a",
              }}
            >
              {isSignUp ? "Create an account" : "Welcome back"}
            </h2>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: "10px",
                color: "#77818c",
              }}
            >
              {isSignUp
                ? "Join CampusBites with your college email"
                : "Sign in to order food and track your meals"}
            </p>
          </div>

          {/* =========================
              FORM
          ========================= */}
          <form onSubmit={handleSubmit}>
            {/* NAME - SIGN UP ONLY */}
            {isSignUp && (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#26313b",
                  }}
                >
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Deepika Kumar"
                  style={{
                    width: "100%",
                    height: "43px",
                    boxSizing: "border-box",
                    border: "1.5px solid #dce4e9",
                    borderRadius: "10px",
                    padding: "0 13px",
                    fontSize: "11px",
                    outline: "none",
                  }}
                />
              </div>
            )}

            {/* EMAIL */}
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#26313b",
                }}
              >
                College Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vitstudent.ac.in"
                style={{
                  width: "100%",
                  height: "43px",
                  boxSizing: "border-box",
                  border: "1.5px solid #dce4e9",
                  borderRadius: "10px",
                  padding: "0 13px",
                  fontSize: "11px",
                  outline: "none",
                }}
              />
            </div>

            {/* PASSWORD */}
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#26313b",
                }}
              >
                Password
              </label>

              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    height: "43px",
                    boxSizing: "border-box",
                    border: "1.5px solid #dce4e9",
                    borderRadius: "10px",
                    padding: "0 42px 0 13px",
                    fontSize: "11px",
                    outline: "none",
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* REMEMBER / FORGOT - LOGIN ONLY */}
            {!isSignUp && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "10px",
                    color: "#68737c",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    style={{
                      accentColor: "#08a879",
                    }}
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setError("Demo mode: password reset is not connected.")
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#078f69",
                    fontSize: "10px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* ERROR MESSAGE */}
            {error && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  background: "#fff1f1",
                  border: "1px solid #ffd0d0",
                  color: "#dc3b3b",
                  fontSize: "10px",
                }}
              >
                {error}
              </div>
            )}

            {/* =========================
                LOGIN / CREATE ACCOUNT
            ========================= */}
            <button
              type="submit"
              style={{
                display: "block",
                width: "100%",
                height: "46px",
                border: "none",
                borderRadius: "11px",
                background: "#08a879",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0,140,100,0.22)",
              }}
            >
              {isSignUp ? "Create account" : "Log in"}
            </button>

            {/* =========================
                DIVIDER
            ========================= */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "16px 0",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "#e5eaed",
                }}
              />

              <span
                style={{
                  fontSize: "9px",
                  color: "#a2abb3",
                }}
              >
                or continue with
              </span>

              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "#e5eaed",
                }}
              />
            </div>

            {/* GOOGLE */}
            <button
              type="button"
              onClick={() =>
                setError("Google sign-in is available in the full application.")
              }
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "11px",
                border: "1.5px solid #dce4e9",
                background: "#ffffff",
                color: "#26313b",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  color: "#4285F4",
                  fontSize: "15px",
                  fontWeight: "800",
                  marginRight: "8px",
                }}
              >
                G
              </span>
              Continue with Google
            </button>
          </form>

          {/* =========================
              BOTTOM SWITCH
          ========================= */}
          <p
            style={{
              textAlign: "center",
              margin: "17px 0 0",
              fontSize: "10px",
              color: "#78828b",
            }}
          >
            {isSignUp ? "Already have an account?" : "Don't have an account?"}

            <button
              type="button"
              onClick={() => changeMode(isSignUp ? "login" : "signup")}
              style={{
                border: "none",
                background: "transparent",
                color: "#078f69",
                fontSize: "10px",
                fontWeight: "800",
                marginLeft: "4px",
                cursor: "pointer",
              }}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>

          {/* =========================
              DEMO MESSAGE
          ========================= */}
          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#f6f8f9",
              border: "1px solid #e5eaed",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "8px",
                lineHeight: "12px",
                color: "#78828b",
              }}
            >
              <strong style={{ color: "#39444d" }}>💡 Demo Mode:</strong> Any
              email and 6+ character password can be used.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
