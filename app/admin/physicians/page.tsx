import { redirect }     from "next/navigation";
import { requireAdmin } from "@/src/lib/requireAdmin";
import { prisma }       from "@/src/lib/prisma";
import Link             from "next/link";
import AdminPhysicianList from "@/src/components/admin/AdminPhysicianList";

export default async function AdminPhysiciansPage() {
  const { error } = await requireAdmin();
  if (error) redirect("/");

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
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">Myo</span>
            <span className="text-sm font-bold text-teal-400">Guard</span>
            <span className="text-xs text-slate-500 ml-1">Admin</span>
            <Link
              href="/admin/founders"
              className="ml-2 text-xs text-teal-400 hover:text-teal-300 border border-teal-800 hover:border-teal-600 rounded-md px-3 py-1 transition-colors"
            >
              Founder Pilot →
            </Link>
          </div>
        </div>
        <AdminPhysicianList applications={applications} />
      </div>
    </div>
  );
}
