"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type QuestionnaireSchema = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
};

type QuestionnaireField = {
  id: string;
  schemaId: string;
  section: string;
  fieldName: string;
  fieldType: string;
  label: string;
  description: string | null;
  isRequired: boolean;
  orderIndex: number;
};

export default function AdminSchemasPage() {
  const [schemas, setSchemas] = useState<QuestionnaireSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<QuestionnaireSchema | null>(null);
  const [fields, setFields] = useState<QuestionnaireField[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [currentSchema, setCurrentSchema] = useState<Partial<QuestionnaireSchema>>({ isActive: true, version: 1 });
  
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [currentField, setCurrentField] = useState<Partial<QuestionnaireField>>({ isRequired: false, orderIndex: 0 });

  useEffect(() => {
    fetchSchemas();
  }, []);

  const fetchSchemas = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/schemas");
      setSchemas(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (schemaId: string) => {
    try {
      const res = await api.get(`/admin/schemas/${schemaId}/fields`);
      setFields(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectSchema = (schema: QuestionnaireSchema) => {
    setSelectedSchema(schema);
    fetchFields(schema.id);
  };

  // Schema functions
  const handleSaveSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentSchema.id) {
        await api.patch(`/admin/schemas/${currentSchema.id}`, currentSchema);
      } else {
        await api.post("/admin/schemas", currentSchema);
      }
      setIsSchemaModalOpen(false);
      fetchSchemas();
    } catch (err) {
      console.error(err);
    }
  };

  // Field functions
  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchema) return;
    try {
      if (currentField.id) {
        await api.patch(`/admin/schemas/fields/${currentField.id}`, currentField);
      } else {
        await api.post(`/admin/schemas/${selectedSchema.id}/fields`, currentField);
      }
      setIsFieldModalOpen(false);
      fetchFields(selectedSchema.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm('Delete field?')) return;
    try {
      await api.delete(`/admin/schemas/fields/${id}`);
      if (selectedSchema) fetchFields(selectedSchema.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading schemas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Form Schemas</h1>
          <p className="text-slate-500 mt-1 text-sm">Design and version your registration questionnaires.</p>
        </div>
        {!selectedSchema && (
          <Button onClick={() => { setCurrentSchema({ isActive: true, version: 1 }); setIsSchemaModalOpen(true); }}>
            Create Schema
          </Button>
        )}
        {selectedSchema && (
          <Button variant="ghost" onClick={() => setSelectedSchema(null)}>
            &larr; Back to Schemas
          </Button>
        )}
      </div>

      {!selectedSchema ? (
        // Schemas List
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-medium text-slate-700">Name</th>
                  <th className="p-4 font-medium text-slate-700">Version</th>
                  <th className="p-4 font-medium text-slate-700">Status</th>
                  <th className="p-4 font-medium text-right text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schemas.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-primary">{s.name}</td>
                    <td className="p-4 text-slate-600">
                      <Badge variant="secondary">v{s.version}</Badge>
                    </td>
                    <td className="p-4 text-slate-600">
                      <Badge variant={s.isActive ? 'success' : 'destructive'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setCurrentSchema(s); setIsSchemaModalOpen(true); }}>Edit</Button>
                        <Button variant="secondary" size="sm" onClick={() => selectSchema(s)}>Manage Fields</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {schemas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500">
                      No schemas found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Fields List
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Fields for {selectedSchema.name}</h2>
            <Button onClick={() => { setCurrentField({ isRequired: false, orderIndex: 0 }); setIsFieldModalOpen(true); }}>
              Add Field
            </Button>
          </div>
          
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-4 font-medium text-slate-700">Section</th>
                    <th className="p-4 font-medium text-slate-700">Field Name</th>
                    <th className="p-4 font-medium text-slate-700">Label</th>
                    <th className="p-4 font-medium text-slate-700">Type</th>
                    <th className="p-4 font-medium text-slate-700">Required</th>
                    <th className="p-4 font-medium text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-600">{f.section}</td>
                      <td className="p-4 font-mono text-xs text-slate-500">{f.fieldName}</td>
                      <td className="p-4 text-slate-700">{f.label}</td>
                      <td className="p-4">
                        <Badge variant="outline">{f.fieldType}</Badge>
                      </td>
                      <td className="p-4">
                        {f.isRequired ? (
                          <span className="text-rose-600 text-xs font-bold uppercase tracking-wider">Yes</span>
                        ) : (
                          <span className="text-slate-400 text-xs uppercase tracking-wider">No</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setCurrentField(f); setIsFieldModalOpen(true); }}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteField(f.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500">
                        No fields defined yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Schema Modal */}
      {isSchemaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">{currentSchema.id ? 'Edit' : 'Create'} Schema</h2>
            <form onSubmit={handleSaveSchema} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Name</label>
                <Input required type="text" placeholder="Profile Schema V1" value={currentSchema.name || ''} onChange={(e) => setCurrentSchema({ ...currentSchema, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Version Number</label>
                <Input type="number" min="1" value={currentSchema.version || 1} onChange={(e) => setCurrentSchema({ ...currentSchema, version: parseInt(e.target.value) })} />
              </div>
              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" id="schemaActive" className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" checked={currentSchema.isActive || false} onChange={(e) => setCurrentSchema({ ...currentSchema, isActive: e.target.checked })} />
                <label htmlFor="schemaActive" className="text-sm font-semibold text-slate-700 cursor-pointer">Active and Ready</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsSchemaModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save Schema</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Modal */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">{currentField.id ? 'Edit' : 'Add'} Data Field</h2>
            <form onSubmit={handleSaveField} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Section</label>
                  <Input required type="text" value={currentField.section || ''} onChange={(e) => setCurrentField({ ...currentField, section: e.target.value })} placeholder="basic_info" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Field ID Key</label>
                  <Input required type="text" value={currentField.fieldName || ''} onChange={(e) => setCurrentField({ ...currentField, fieldName: e.target.value })} placeholder="firstName" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Display Label</label>
                <Input required type="text" value={currentField.label || ''} onChange={(e) => setCurrentField({ ...currentField, label: e.target.value })} placeholder="First Name" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Input Component Type</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                  value={currentField.fieldType || 'text'} 
                  onChange={(e) => setCurrentField({ ...currentField, fieldType: e.target.value })}
                >
                  <option value="text">Single Line Text</option>
                  <option value="textarea">Multi-line Textarea</option>
                  <option value="number">Numeric Value</option>
                  <option value="select">Dropdown Menu</option>
                  <option value="radio">Radio Buttons List</option>
                  <option value="checkbox">Toggle Checkbox</option>
                  <option value="date">Date Picker</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 py-2">
                  <input type="checkbox" id="isRequired" className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" checked={currentField.isRequired || false} onChange={(e) => setCurrentField({ ...currentField, isRequired: e.target.checked })} />
                  <label htmlFor="isRequired" className="text-sm font-semibold text-slate-700 cursor-pointer">Required</label>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Visual Order</label>
                  <Input type="number" value={currentField.orderIndex || 0} onChange={(e) => setCurrentField({ ...currentField, orderIndex: parseInt(e.target.value) })} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsFieldModalOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
