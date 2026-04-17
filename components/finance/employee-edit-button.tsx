"use client";

import { useState } from "react";
import { EmployeeCreateModal } from "./employee-create-modal";

interface EmployeeData {
  id: string | number;
  name: string;
  company: string;
  position?: string;
  department?: string;
  employment_type?: string;
  email?: string;
  phone?: string;
  annual_salary?: number;
  hourly_wage?: number;
  weekly_days?: number;
  daily_hours?: number;
  work_days?: string;
  join_date?: string;
  status?: string;
}

export function EmployeeEditButton({ employee, companies }: { employee: EmployeeData; companies: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper"
      >
        ✏️ 수정
      </button>
      {open && (
        <EmployeeCreateModal
          companies={companies}
          editing={employee}
          controlledOpen={true}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
