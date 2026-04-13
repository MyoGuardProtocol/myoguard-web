import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import AdminPhysicianList from "@/src/components/admin/AdminPhysicianList";

export default async function AdminPhysiciansPage() {
  const { userId } = await auth();

  if (userId !== process.env.ADMIN_USER_ID) {
    redirect("/");
  }

  const applications = await prisma.physicianApplication.findMany({
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">
              Physician Applications
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {applications.filter(a => a.status === "PENDING").length} pending review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Myo</span>
            <span className="text-sm font-bold text-teal-400">Guard</span>
            <span className="text-xs text-slate-500 ml-2">Admin</span>
          </div>
        </div>
        <AdminPhysicianList applications={applications} />
      </div>
    </div>
  );
}
