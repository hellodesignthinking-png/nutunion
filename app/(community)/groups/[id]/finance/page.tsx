"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  CreditCard,
  Plus,
  ArrowLeft,
  ChevronRight,
  Eye,
  Columns,
  Maximize2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  X,
  FileText,
  TrendingUp,
  Receipt,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { ResourcePreviewModal } from "@/components/shared/resource-preview-modal";

interface Expenditure {
  id: string;
  date: string;
  category: string;
  item: string;
  amount: number;
  payer: string;
  receiptUrl: string | null;
  status: "pending" | "approved" | "rejected";
  approvedAt?: string;
}

const mockExpenditures: Expenditure[] = [
  { id: "1", date: "2026-04-05", category: "운영비", item: "대관료 (워크필드 302호)", amount: 150000, payer: "홍길동", receiptUrl: "https://docs.google.com/document/d/1X-example-receipt/preview", status: "pending" },
  { id: "2", date: "2026-04-06", category: "다과비", item: "스타벅스 커피 8잔", amount: 45000, payer: "김철수", receiptUrl: "https://drive.google.com/file/d/1Y-example-image/preview", status: "pending" },
  { id: "3", date: "2024-04-01", category: "회의비", item: "점심 식대 (김밥천국)", amount: 32000, payer: "이영희", receiptUrl: "https://docs.google.com/spreadsheets/d/1Z-example-sheet/preview", status: "approved", approvedAt: "2024-04-02" },
];

export default function GroupFinancePage() {
  const params = useParams();
  const groupId = params.id as string;

  const [expenditures, setExpenditures] = useState<Expenditure[]>(mockExpenditures);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string; name: string; id: string } | null>(null);
  const [isSplitView, setIsSplitView] = useState(true); // Default to split view for efficiency

  useEffect(() => {
    // In a real app, load from Supabase
    setGroupName("넛유니온 소모임");
    setIsManager(true); // Assuming manager for demo
  }, [groupId]);

  const handleStatusUpdate = (id: string, status: "approved" | "rejected") => {
    setExpenditures(prev => 
      prev.map(exp => exp.id === id ? { ...exp, status, approvedAt: status === "approved" ? new Date().toISOString() : undefined } : exp)
    );
    
    if (status === "approved") {
      toast.success("정산이 승인되었습니다! 활동 지수와 Nut Points가 지급됩니다.");
    } else {
      toast.error("정산이 반려되었습니다.");
    }
    
    // Clear preview if current
    if (previewData?.id === id) {
      setPreviewData(null);
    }
  };

  const totals = {
    total: expenditures.reduce((acc, curr) => acc + curr.amount, 0),
    pending: expenditures.filter(e => e.status === "pending").reduce((acc, curr) => acc + curr.amount, 0),
    count: expenditures.filter(e => e.status === "pending").length
  };

  return (
    <div className={`mx-auto px-4 md:px-8 py-10 transition-all duration-500 ${isSplitView ? "max-w-full" : "max-w-5xl"}`}>
      
      {/* Split View Wrapper */}
      <div className={`flex flex-col lg:flex-row gap-8`}>
        
        {/* Main Content Area */}
        <div className={`transition-all duration-500 ${isSplitView ? "lg:w-[50%] xl:w-[45%] shrink-0" : "w-full"}`}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[11px] uppercase tracking-widest">
            <Link href={`/groups/${groupId}`} className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
              <ArrowLeft size={12} /> {groupName}
            </Link>
            <ChevronRight size={12} className="text-nu-muted/40" />
            <span className="text-nu-ink">자금 관리 & 정산</span>
          </nav>

          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="font-head text-3xl font-extrabold text-nu-ink">자금 관리 & 정산</h1>
              <p className="text-nu-gray text-sm mt-1">프로젝트 비용 집행 및 영수증 검토 시스템</p>
            </div>
            <button
              onClick={() => setIsSplitView(!isSplitView)}
              className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] transition-all flex items-center gap-2 ${
                isSplitView ? "bg-nu-ink text-nu-paper border-nu-ink" : "bg-nu-white border-nu-ink/10 text-nu-muted hover:border-nu-ink"
              }`}
            >
              {isSplitView ? <Maximize2 size={13} /> : <Columns size={13} />}
              <span className="hidden sm:inline">{isSplitView ? "단일 뷰" : "스플릿 뷰"}</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-nu-white border-[2px] border-nu-ink p-4 shadow-[4px_4px_0px_0px_#0d0d0d]">
              <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-1">총 지출</p>
              <p className="font-head text-xl font-black text-nu-ink">₩{totals.total.toLocaleString()}</p>
            </div>
            <div className="bg-nu-pink/5 border-[2px] border-nu-pink/30 p-4 shadow-[4px_4px_0px_0px_#FF2E97]">
              <p className="font-mono-nu text-[10px] text-nu-pink uppercase tracking-widest mb-1">미정산 (대기)</p>
              <p className="font-head text-xl font-black text-nu-pink">{totals.count}건 / ₩{totals.pending.toLocaleString()}</p>
            </div>
            <div className="bg-nu-blue/5 border-[2px] border-nu-blue/30 p-4">
              <p className="font-mono-nu text-[10px] text-nu-blue uppercase tracking-widest mb-1">지급 예정 포인트</p>
              <p className="font-head text-xl font-black text-nu-blue">{(totals.total / 100).toLocaleString()} NUT</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-nu-white border-[2px] border-nu-ink overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-nu-ink text-nu-paper font-mono-nu text-[10px] uppercase tracking-widest">
                  <th className="px-4 py-3 border-r border-nu-paper/10">일자</th>
                  <th className="px-4 py-3 border-r border-nu-paper/10">항목</th>
                  <th className="px-4 py-3 border-r border-nu-paper/10 text-right">금액</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {expenditures.map((exp) => (
                  <tr 
                    key={exp.id} 
                    onClick={() => exp.receiptUrl && setPreviewData({ url: exp.receiptUrl, name: exp.item, id: exp.id })}
                    className={`border-b border-nu-ink/5 hover:bg-nu-cream/30 cursor-pointer transition-colors ${previewData?.id === exp.id ? "bg-nu-pink/5" : ""}`}
                  >
                    <td className="px-4 py-4">
                      <p className="text-xs font-mono-nu text-nu-muted">{exp.date}</p>
                      <p className="text-[10px] font-bold text-nu-ink">{exp.category}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold text-nu-ink truncate max-w-[150px]">{exp.item}</p>
                      <p className="text-[10px] text-nu-muted">결제자: {exp.payer}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-sm font-head font-black text-nu-ink">₩{exp.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded ${
                        exp.status === "approved" ? "bg-green-100 text-green-700" : 
                        exp.status === "rejected" ? "bg-red-100 text-red-700" : "bg-nu-amber/10 text-nu-amber"
                      }`}>
                        {exp.status === "approved" ? <CheckCircle2 size={10} /> : 
                         exp.status === "rejected" ? <XCircle size={10} /> : <Clock size={10} />}
                        {exp.status === "approved" ? "승인됨" : exp.status === "rejected" ? "반려됨" : "검토중"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel Area (Split View Document Viewer) */}
        {isSplitView && (
          <div className="lg:flex-1 lg:sticky lg:top-8 w-full animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="bg-nu-paper border-2 border-nu-ink shadow-2xl flex flex-col h-[85vh] lg:h-[calc(100vh-80px)]">
              {previewData ? (
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between px-5 py-4 border-b-2 border-nu-ink bg-nu-ink text-nu-paper">
                    <div className="min-w-0 pr-4">
                      <p className="font-head text-[13px] font-black truncate uppercase tracking-tight">{previewData.name}</p>
                      <p className="font-mono-nu text-[9px] text-nu-paper/60 truncate uppercase tracking-widest mt-0.5">영수증 & 증빙 자료 검토</p>
                    </div>
                    <button onClick={() => setPreviewData(null)} className="p-1.5 text-nu-paper/60 hover:text-nu-paper">
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Iframe */}
                  <div className="flex-1 bg-nu-white overflow-hidden relative border-b-2 border-nu-ink">
                    <iframe 
                      src={previewData.url}
                      className="w-full h-full border-0"
                      allow="autoplay; encrypted-media; fullscreen"
                    />
                  </div>

                  {/* Actions Drawer */}
                  <div className="p-6 bg-nu-cream/30 space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-nu-white border-2 border-nu-ink/10 rounded">
                      <div className="w-10 h-10 bg-nu-blue/10 flex items-center justify-center shrink-0">
                         <Receipt size={18} className="text-nu-blue" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-nu-ink">정산 승인 안내</p>
                        <p className="text-[11px] text-nu-muted leading-relaxed mt-1">
                          영수증의 금액과 항목이 일치하는지 확인해 주세요. 승인 시 프로젝트 자금에서 즉시 해당 금액이 차감되며 지출 내역이 확정됩니다.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleStatusUpdate(previewData.id, "approved")}
                        className="flex items-center justify-center gap-2 py-4 bg-nu-blue text-nu-paper font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-nu-blue/90 transition-all"
                      >
                        <CheckCircle2 size={16} /> 정산 승인
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(previewData.id, "rejected")}
                        className="flex items-center justify-center gap-2 py-4 bg-nu-paper border-2 border-nu-ink text-nu-ink font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-red-50 hover:text-red-500 hover:border-red-500 transition-all"
                      >
                        <XCircle size={16} /> 반려 하기
                      </button>
                    </div>
                    
                    <button className="w-full flex items-center justify-center gap-2 py-3 border border-nu-ink/10 text-nu-muted hover:text-nu-ink transition-colors font-mono-nu text-[10px] uppercase tracking-widest">
                      <FileText size={12} /> 반려 사유 입력 (선택)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-nu-muted">
                  <div className="w-20 h-20 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-4">
                    <CreditCard size={32} className="opacity-20 text-nu-blue" />
                  </div>
                  <p className="font-head text-sm font-bold text-nu-ink/40 uppercase tracking-widest">Select an entry to review</p>
                  <p className="text-[11px] mt-2 max-w-[200px]">지출 내역을 선택하면 우측에서 영수증을 확인하고 정산을 승인할 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resource Preview Modal (Desktop/Standard mode) */}
      {!isSplitView && (
        <ResourcePreviewModal 
          isOpen={!!previewData}
          onClose={() => setPreviewData(null)}
          url={previewData?.url || ""}
          name={previewData?.name || ""}
        />
      )}
    </div>
  );
}
