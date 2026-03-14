import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
      <h1 style={{ color: "black", marginBottom: "20px" }}>Sign Up for MyoGuard</h1>
      <div style={{ border: "2px solid red", padding: "20px", minWidth: "300px", minHeight: "200px" }}>
        <SignUp />
      </div>
    </div>
  )
}
