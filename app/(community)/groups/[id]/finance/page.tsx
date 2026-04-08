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
  const [isSplitView, setIsSplitView] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");

  const [contributionData, setContributionData] = useState<Record<string, { meetings: number; resources: number; tasks: number }>>({
    "홍길동": { meetings: 12, resources: 5, tasks: 8 },
    "김철수": { meetings: 8, resources: 2, tasks: 3 },
    "이영희": { meetings: 15, resources: 10, tasks: 12 },
  });

  const workflowSteps = [
    { key: "pending", label: "청구됨", icon: <FileText size={12} />, color: "text-nu-muted" },
    { key: "in_review", label: "검토중", icon: <Search size={12} />, color: "text-nu-amber" },
    { key: "approved", label: "승인됨", icon: <CheckCircle2 size={12} />, color: "text-nu-blue" },
    { key: "paid", label: "지급완료", icon: <TrendingUp size={12} />, color: "text-nu-pink" },
  ];

  const totals = {
    total: expenditures.reduce((acc, curr) => acc + curr.amount, 0),
    pending: expenditures.filter(e => e.status !== "paid").reduce((acc, curr) => acc + curr.amount, 0),
    count: expenditures.filter(e => e.status !== "paid").length
  };

  const filteredExpenditures = activeTab === "all" ? expenditures : expenditures.filter(e => e.payer === "홍길동");

  useEffect(() => {
    setGroupName("넛유니온 소모임");
    setIsManager(true);
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
    
    if (previewData?.id === id) {
      setPreviewData(null);
    }
  };

  return (
    <div className={`mx-auto px-4 md:px-8 py-10 transition-all duration-500 ${isSplitView ? "max-w-full" : "max-w-5xl"}`}>
      
      {/* Split View Wrapper */}
      <div className="flex flex-col lg:flex-row gap-8">
        
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
              <h1 className="font-head text-3xl font-extrabold text-nu-ink tracking-tight lowercase">financial_hub</h1>
              <p className="text-nu-gray text-sm mt-1">기여에 기반한 공정한 정산과 투명한 자금 관리</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSplitView(!isSplitView)}
                className={`p-2.5 border-[2px] transition-all ${
                  isSplitView ? "bg-nu-ink text-nu-paper border-nu-ink" : "bg-nu-white border-nu-ink/10 text-nu-muted hover:border-nu-ink"
                }`}
              >
                {isSplitView ? <Maximize2 size={16} /> : <Columns size={16} />}
              </button>
            </div>
          </div>

          {/* Combined Stats & Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
             <div className="bg-nu-ink text-nu-paper p-5 shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <p className="font-mono-nu text-[9px] uppercase tracking-[0.3em] opacity-40 mb-2">Total Project Liquidity</p>
                  <p className="font-head text-3xl font-black">₩{totals.total.toLocaleString()}</p>
                  <div className="flex gap-4 mt-4">
                    <div className="flex flex-col">
                      <span className="font-mono-nu text-[8px] text-nu-paper/40">미정산</span>
                      <span className="text-sm font-bold text-nu-amber">₩{totals.pending.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col border-l border-nu-paper/10 pl-4">
                      <span className="font-mono-nu text-[8px] text-nu-paper/40">기여 포인트</span>
                      <span className="text-sm font-bold text-nu-blue">{(totals.total / 100).toLocaleString()}P</span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <TrendingUp size={64} />
                </div>
             </div>

             <div className="bg-nu-white border-2 border-nu-ink p-1 flex flex-col justify-between">
                <div className="flex border-b border-nu-ink/5">
                  <button 
                    onClick={() => setActiveTab("all")}
                    className={`flex-1 py-3 font-mono-nu text-[10px] uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-nu-ink text-nu-paper' : 'text-nu-muted hover:bg-nu-cream/30'}`}
                  >
                    All Transactions
                  </button>
                  <button 
                    onClick={() => setActiveTab("my")}
                    className={`flex-1 py-3 font-mono-nu text-[10px] uppercase tracking-widest transition-all ${activeTab === 'my' ? 'bg-nu-ink text-nu-paper' : 'text-nu-muted hover:bg-nu-cream/30'}`}
                  >
                    My Waiting Room
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-nu-muted leading-relaxed italic">
                    {activeTab === 'all' 
                      ? "프로젝트 전체 자금의 흐름과 멤버들의 기여 증빙을 검토합니다." 
                      : "본인의 정산 요청 상태를 실시간으로 추적할 수 있는 대기실입니다."}
                  </p>
                </div>
             </div>
          </div>

          {/* Search & Actions */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
              <input 
                placeholder="항목 또는 결제자 검색" 
                className="w-full pl-10 pr-4 py-2.5 bg-nu-white border-2 border-nu-ink/10 focus:border-nu-ink transition-all text-sm outline-none"
              />
            </div>
            <button className="bg-nu-pink text-nu-paper font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 hover:bg-nu-ink transition-all inline-flex items-center gap-2">
              <Plus size={14} /> NEW CLAIM
            </button>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            {filteredExpenditures.map((exp) => (
              <div 
                key={exp.id} 
                onClick={() => exp.receiptUrl && setPreviewData({ url: exp.receiptUrl, name: exp.item, id: exp.id })}
                className={`group bg-nu-paper border-2 transition-all cursor-pointer p-4 ${
                  previewData?.id === exp.id ? "border-nu-pink shadow-[4px_4px_0px_0px_#FF2E97]" : "border-nu-ink/10 hover:border-nu-ink active:translate-y-0.5"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 flex items-center justify-center border-2 ${previewData?.id === exp.id ? 'border-nu-pink bg-nu-pink/5' : 'border-nu-ink/10'}`}>
                      <CreditCard size={14} className={previewData?.id === exp.id ? 'text-nu-pink' : 'text-nu-muted'} />
                    </div>
                    <div>
                      <p className="font-head text-[13px] font-bold text-nu-ink leading-tight">{exp.item}</p>
                      <p className="font-mono-nu text-[9px] text-nu-muted uppercase mt-0.5">{exp.payer} · {exp.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-head text-sm font-black text-nu-ink">₩{exp.amount.toLocaleString()}</p>
                    <p className="font-mono-nu text-[8px] text-nu-blue uppercase mt-0.5">{(exp.amount / 100).toLocaleString()} POINT</p>
                  </div>
                </div>

                {/* Workflow Status Tracker */}
                <div className="flex items-center justify-between gap-1 pt-3 border-t border-nu-ink/5 overflow-hidden">
                  {workflowSteps.map((step, idx) => {
                    const isPassed = ["pending", "in_review", "approved", "paid"].indexOf(exp.status) >= idx;
                    const isCurrent = exp.status === step.key;
                    
                    return (
                      <div key={step.key} className="flex-1 flex items-center">
                        <div className="flex flex-col items-center gap-1.5 relative z-10">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isPassed ? 'bg-nu-ink border-nu-ink text-nu-paper' : 'bg-nu-white border-nu-ink/10 text-nu-muted/30'
                          }`}>
                            {isPassed ? <CheckCircle2 size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-nu-ink/20" />}
                          </div>
                          <span className={`font-mono-nu text-[7px] uppercase tracking-tighter ${isPassed ? 'text-nu-ink font-bold font-black' : 'text-nu-muted/40'}`}>
                            {step.label}
                          </span>
                        </div>
                        {idx < workflowSteps.length - 1 && (
                          <div className={`flex-1 h-[2px] mb-4 -mx-1 transition-all ${
                            ["pending", "in_review", "approved", "paid"].indexOf(exp.status) > idx ? 'bg-nu-ink' : 'bg-nu-ink/5'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel Area (Advanced Review Console) */}
        {isSplitView && (
          <div className="lg:flex-1 lg:sticky lg:top-8 w-full animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="bg-nu-white border-2 border-nu-ink shadow-2xl flex flex-col h-[85vh] lg:h-[calc(100vh-80px)]">
              {previewData ? (
                <div className="flex-1 flex flex-col h-full overflow-y-auto scrollbar-hide">
                  <div className="flex items-center justify-between px-5 py-4 border-b-2 border-nu-ink bg-nu-pink text-nu-paper">
                    <div className="min-w-0 pr-4">
                      <p className="font-head text-[13px] font-black truncate uppercase tracking-tight">{previewData.name}</p>
                      <p className="font-mono-nu text-[9px] text-nu-paper/70 truncate uppercase tracking-widest mt-0.5">Advanced Settlement Review</p>
                    </div>
                    <button onClick={() => setPreviewData(null)} className="p-1.5 text-nu-paper/70 hover:text-nu-paper">
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Contribution Identity Dashboard */}
                  <div className="p-5 bg-nu-ink text-nu-paper">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-nu-paper/10 rounded-full flex items-center justify-center border border-nu-paper/20 shrink-0">
                        <Users size={20} className="text-nu-paper" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-head text-lg font-black tracking-tight">{expenditures.find(e => e.id === previewData.id)?.payer}</p>
                        <p className="font-mono-nu text-[9px] text-nu-paper/40 uppercase tracking-widest">Core Project Contributor</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                       <div className="bg-nu-paper/5 p-2 text-center border border-nu-paper/10">
                          <p className="text-xl font-black font-head">{contributionData[expenditures.find(e => e.id === previewData.id)?.payer || ""]?.meetings}</p>
                          <p className="font-mono-nu text-[7px] text-nu-paper/30 uppercase mt-0.5">Sessions</p>
                       </div>
                       <div className="bg-nu-paper/5 p-2 text-center border border-nu-paper/10">
                          <p className="text-xl font-black font-head">{contributionData[expenditures.find(e => e.id === previewData.id)?.payer || ""]?.resources}</p>
                          <p className="font-mono-nu text-[7px] text-nu-paper/30 uppercase mt-0.5">Knowledge</p>
                       </div>
                       <div className="bg-nu-paper/5 p-2 text-center border border-nu-paper/10">
                          <p className="text-xl font-black font-head text-nu-blue">{contributionData[expenditures.find(e => e.id === previewData.id)?.payer || ""]?.tasks}</p>
                          <p className="font-mono-nu text-[7px] text-nu-paper/30 uppercase mt-0.5">Execution</p>
                       </div>
                    </div>
                  </div>

                  {/* Document Iframe */}
                  <div className="flex-1 min-h-[400px] bg-nu-paper relative border-b-2 border-nu-ink overflow-hidden">
                    <iframe 
                      src={previewData.url}
                      className="w-full h-full border-0"
                      allow="autoplay; encrypted-media; fullscreen"
                    />
                    <div className="absolute top-4 right-4 group">
                      <a href={previewData.url} target="_blank" className="p-2 bg-nu-paper/80 backdrop-blur-md border border-nu-ink/10 text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all">
                        <Maximize2 size={16} />
                      </a>
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="p-6 bg-nu-cream/30 space-y-4">
                    <div className="bg-nu-white p-4 border border-nu-ink/10">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-nu-pink" />
                        <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest">Reward Simulation</span>
                      </div>
                      <p className="text-[11px] text-nu-muted leading-relaxed">
                        해당 멤버의 높은 기여 지수(미팅 참여 {contributionData[expenditures.find(e => e.id === previewData.id)?.payer || ""]?.meetings}회 등)를 고려할 때, 본 정산 승인 시 **가중 인센티브 5%**가 추가 적용될 예정입니다.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleStatusUpdate(previewData.id, "approved")}
                        className="flex flex-col items-center justify-center gap-1 py-4 bg-nu-blue text-nu-paper hover:bg-nu-ink transition-all shadow-xl shadow-nu-blue/10"
                      >
                        <CheckCircle2 size={18} />
                        <span className="font-mono-nu text-[9px] font-black uppercase tracking-widest">Final Approval</span>
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(previewData.id, "rejected")}
                        className="flex flex-col items-center justify-center gap-1 py-4 bg-nu-white border-2 border-nu-ink text-nu-ink hover:bg-red-50 hover:text-red-500 hover:border-red-500 transition-all"
                      >
                        <XCircle size={18} />
                        <span className="font-mono-nu text-[9px] font-black uppercase tracking-widest">Request Revision</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-nu-muted">
                  <div className="w-24 h-24 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Receipt size={40} className="opacity-10 text-nu-ink" />
                  </div>
                  <h3 className="font-head text-lg font-black text-nu-ink/30 uppercase tracking-widest">Verification Console</h3>
                  <p className="text-[11px] mt-4 max-w-[240px] leading-relaxed mx-auto text-nu-muted">
                    지출 내역을 선택하면 AI가 분석한 **멤버의 기여 데이터**와 **증빙 영수증**을 한 화면에서 대조할 수 있습니다.
                  </p>
                  <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-nu-ink/10" />
                    <div className="w-2 h-2 rounded-full bg-nu-ink/5" />
                    <div className="w-2 h-2 rounded-full bg-nu-ink/5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
