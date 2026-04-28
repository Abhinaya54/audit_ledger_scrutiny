import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { workbooksApi } from '../../api/workbooksApi';
import { useAuth } from '../context/AuthContext';
interface WorkbookDisplay {
  id: string;
  clientName: string;
  financialYear: string;
  status: 'Draft' | 'In Progress' | 'Completed';
  lastModified: string;
  riskScore?: number;
}
export default function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [workbooks, setWorkbooks] = useState<WorkbookDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkbooks = async () => {
      try {
        setIsLoading(true);
        const data = await workbooksApi.listWorkbooks();
        const mapped: WorkbookDisplay[] = data.map((wb) => ({
          id: wb.id,
          clientName: wb.client_name,
          financialYear: wb.financial_year,
          status: wb.analysis_summary ? 'Completed' : 'In Progress',
          lastModified: wb.last_modified ? new Date(wb.last_modified).toLocaleDateString() : '—',
          riskScore: wb.analysis_summary
            ? Math.round(
                ((wb.analysis_summary.total_flagged || 0) /
                  (wb.analysis_summary.total_entries || 1)) *
                  100
              )
            : undefined,
        }));
        setWorkbooks(mapped);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load workbooks');
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkbooks();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-700';
      case 'In Progress':
        return 'bg-[#A7C7C6] text-[#074645]';
      case 'Completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRiskScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 70) return 'text-red-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-green-600';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl text-gray-900">General Ledger Scrutiny</h1>
            <p className="text-sm text-gray-600 mt-1">Enterprise Audit Intelligence Platform</p>
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#095859] flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <div className="text-sm text-gray-900">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-500">{user?.email || ''}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                  <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50">
                    Profile Settings
                  </button>
                  <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50">
                    Preferences
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-50"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          {/* Top Section */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl text-gray-900 mb-1">Workbooks</h2>
              <p className="text-sm text-gray-600">Manage audit engagement workbooks</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#095859] text-white rounded-lg hover:bg-[#0B6B6A] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Workbook
            </button>
          </div>

          {/* Workbooks Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Client Name</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Financial Year</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Status</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Last Modified</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#095859] mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading workbooks...</p>
                    </td>
                  </tr>
                ) : workbooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                      No workbooks found. Create your first workbook to get started.
                    </td>
                  </tr>
                ) : (
                  workbooks.map((workbook) => (
                    <tr
                      key={workbook.id}
                      onClick={() => navigate(`/workbook/${workbook.id}`)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">{workbook.clientName}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{workbook.financialYear}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${getStatusColor(workbook.status)}`}>
                          {workbook.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{workbook.lastModified}</td>
                      <td className="px-6 py-4 text-sm">
                        {workbook.riskScore !== undefined ? (
                          <span className={`font-medium ${getRiskScoreColor(workbook.riskScore)}`}>
                            {workbook.riskScore}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Workbook Modal */}
      {showCreateModal && (
        <CreateWorkbookModal
          onClose={() => setShowCreateModal(false)}
          onCreateWorkbook={async (data) => {
            try {
              const newWorkbook = await workbooksApi.createWorkbook({
                client_name: data.clientName,
                financial_year: data.financialYear,
                functional_currency: data.functionalCurrency,
                engagement_type: data.engagementType,
              });
              toast.success('Workbook created');
              setShowCreateModal(false);
              navigate(`/data-ingestion?workbookId=${newWorkbook.id}`);
            } catch (error: any) {
              toast.error(error?.message || 'Failed to create workbook');
            }
          }}
        />
      )}
    </div>
  );
}

interface CreateWorkbookModalProps {
  onClose: () => void;
  onCreateWorkbook: (data: {
    clientName: string;
    financialYear: string;
    functionalCurrency: string;
    engagementType: string;
  }) => void;
}

function CreateWorkbookModal({ onClose, onCreateWorkbook }: CreateWorkbookModalProps) {
  const [clientName, setClientName] = useState('');
  const [financialYear, setFinancialYear] = useState('');
  const [functionalCurrency, setFunctionalCurrency] = useState('INR');
  const [engagementType, setEngagementType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onCreateWorkbook({
      clientName,
      financialYear,
      functionalCurrency,
      engagementType,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-md bg-white bg-opacity-10 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg text-gray-900">Create New Workbook</h2>
          <p className="text-sm text-gray-600 mt-1">Set up a new audit engagement workbook</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="clientName" className="block text-sm text-gray-700 mb-2">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              id="clientName"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent"
              placeholder="e.g., Acme Corporation Ltd."
            />
          </div>

          <div>
            <label htmlFor="financialYear" className="block text-sm text-gray-700 mb-2">
              Financial Year <span className="text-red-500">*</span>
            </label>
            <input
              id="financialYear"
              type="text"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent"
              placeholder="e.g., FY 2023-24"
            />
          </div>

          <div>
            <label htmlFor="functionalCurrency" className="block text-sm text-gray-700 mb-2">
              Functional Currency <span className="text-red-500">*</span>
            </label>
            <select
              id="functionalCurrency"
              value={functionalCurrency}
              onChange={(e) => setFunctionalCurrency(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent"
            >
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>

          <div>
            <label htmlFor="engagementType" className="block text-sm text-gray-700 mb-2">
              Engagement Type
            </label>
            <input
              id="engagementType"
              type="text"
              value={engagementType}
              onChange={(e) => setEngagementType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent"
              placeholder="e.g., Statutory Audit (optional)"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-[#095859] text-white rounded-lg hover:bg-[#0B6B6A] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Workbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
