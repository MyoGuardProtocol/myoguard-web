import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
      <h1 style={{ color: "black", marginBottom: "20px" }}>Sign Up for MyoGuard</h1>
      <SignUp />
    </div>
  )
}
