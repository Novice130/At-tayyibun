"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type FormSchema = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
};

type FormField = {
  id: string;
  schemaId: string;
  fieldName: string;
  fieldType: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: any;
  displayOrder: number;
};

const FIELD_TYPES = [
  { value: "text", label: "Single Line Text" },
  { value: "textarea", label: "Multi-line Textarea" },
  { value: "number", label: "Numeric Value" },
  { value: "select", label: "Dropdown Menu" },
  { value: "radio", label: "Radio Buttons" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date Picker" },
];

export default function AdminSchemasPage() {
  const [schemas, setSchemas] = useState<FormSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<FormSchema | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);

  const [loading, setLoading] = useState(true);

  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [currentSchema, setCurrentSchema] = useState<Partial<FormSchema>>({
    isActive: true,
    version: 1,
  });

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [currentField, setCurrentField] = useState<Partial<FormField>>({
    required: false,
    displayOrder: 0,
    fieldType: "text",
  });

  useEffect(() => {
    fetchSchemas();
  }, []);

  const fetchSchemas = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/schemas");
      setSchemas(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (schemaId: string) => {
    try {
      const res = await api.get(`/admin/schemas/${schemaId}/fields`);
      setFields(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const selectSchema = (schema: FormSchema) => {
    setSelectedSchema(schema);
    fetchFields(schema.id);
  };

  const activateSchema = async (schema: FormSchema) => {
    if (schema.isActive) return;
    if (!confirm(`Activate "${schema.name}" v${schema.version}? All other schemas will be deactivated.`)) return;
    try {
      await api.put(`/admin/schemas/${schema.id}/activate`);
      toast.success('Schema activated');
      fetchSchemas();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate schema");
    }
  };

  const handleSaveSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentSchema.id) {
        await api.patch(`/admin/schemas/${currentSchema.id}`, currentSchema);
        toast.success('Schema updated');
      } else {
        await api.post("/admin/schemas", currentSchema);
        toast.success('Schema created');
      }
      setIsSchemaModalOpen(false);
      fetchSchemas();
    } catch (err: any) {
      toast.error(err.message || "Failed to save schema");
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchema) return;
    try {
      if (currentField.id) {
        await api.patch(`/admin/schemas/fields/${currentField.id}`, currentField);
        toast.success('Field updated');
      } else {
        await api.post(`/admin/schemas/${selectedSchema.id}/fields`, currentField);
        toast.success('Field created');
      }
      setIsFieldModalOpen(false);
      fetchFields(selectedSchema.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to save field");
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Delete field?")) return;
    try {
      await api.delete(`/admin/schemas/fields/${id}`);
      toast.success('Field deleted');
      if (selectedSchema) fetchFields(selectedSchema.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete field");
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading schemas...</div>;

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Form Schemas</h1>
          <p className="text-muted mt-1 text-sm">Design and version signup questionnaires. Exactly one schema can be active.</p>
        </div>
        {!selectedSchema && (
          <Button
            onClick={() => {
              setCurrentSchema({ isActive: false, version: 1 });
              setIsSchemaModalOpen(true);
            }}
          >
            Create Schema
          </Button>
        )}
        {selectedSchema && (
          <Button variant="ghost" onClick={() => setSelectedSchema(null)}>
            ← Back to Schemas
          </Button>
        )}
      </div>

      {!selectedSchema ? (
        <div className="bg-surface rounded-xl border shadow-sm border border-theme overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-hover border-b border-theme">
                <tr>
                  <th className="p-4 font-medium text-secondary">Name</th>
                  <th className="p-4 font-medium text-secondary">Version</th>
                  <th className="p-4 font-medium text-secondary">Status</th>
                  <th className="p-4 font-medium text-right text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {schemas.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                    <td className="p-4 font-semibold text-primary">{s.name}</td>
                    <td className="p-4 text-secondary">
                      <Badge variant="secondary">v{s.version}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={s.isActive ? "success" : "secondary"}>
                        {s.isActive ? "Active" : "Draft"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!s.isActive && (
                          <Button variant="default" size="sm" onClick={() => activateSchema(s)}>
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentSchema(s);
                            setIsSchemaModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => selectSchema(s)}>
                          Fields
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {schemas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-muted">
                      No schemas yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-primary">Fields for {selectedSchema.name} v{selectedSchema.version}</h2>
            <Button
              onClick={() => {
                setCurrentField({
                  required: false,
                  displayOrder: fields.length,
                  fieldType: "text",
                });
                setIsFieldModalOpen(true);
              }}
            >
              Add Field
            </Button>
          </div>

          <div className="bg-surface rounded-xl border shadow-sm border border-theme overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-hover border-b border-theme">
                  <tr>
                    <th className="p-4 font-medium text-secondary">Order</th>
                    <th className="p-4 font-medium text-secondary">Field Name</th>
                    <th className="p-4 font-medium text-secondary">Label</th>
                    <th className="p-4 font-medium text-secondary">Type</th>
                    <th className="p-4 font-medium text-secondary">Required</th>
                    <th className="p-4 font-medium text-secondary text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {fields.map((f) => (
                    <tr key={f.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-4 font-mono text-xs text-muted">{f.displayOrder}</td>
                      <td className="p-4 font-mono text-xs text-muted">{f.fieldName}</td>
                      <td className="p-4 text-secondary">{f.label}</td>
                      <td className="p-4">
                        <Badge variant="outline">{f.fieldType}</Badge>
                      </td>
                      <td className="p-4">
                        {f.required ? (
                          <span className="text-rose-600 text-xs font-bold uppercase">Yes</span>
                        ) : (
                          <span className="text-muted text-xs uppercase">No</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentField(f);
                              setIsFieldModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteField(f.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {fields.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted">
                        No fields yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isSchemaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-theme">
            <h2 className="text-2xl font-bold mb-6 text-primary">{currentSchema.id ? "Edit" : "Create"} Schema</h2>
            <form onSubmit={handleSaveSchema} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-secondary">Name</label>
                <Input
                  required
                  type="text"
                  placeholder="Profile Schema"
                  value={currentSchema.name || ""}
                  onChange={(e) => setCurrentSchema({ ...currentSchema, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-secondary">Version</label>
                <Input
                  type="number"
                  min="1"
                  value={currentSchema.version || 1}
                  onChange={(e) => setCurrentSchema({ ...currentSchema, version: parseInt(e.target.value) })}
                />
              </div>
              <div className="text-xs text-muted">
                Use the "Activate" button in the list to publish a schema (atomic flip).
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsSchemaModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFieldModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl max-w-md w-full p-8 shadow-2xl border border-theme max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-primary">{currentField.id ? "Edit" : "Add"} Field</h2>
            <form onSubmit={handleSaveField} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-secondary">Field Name (key)</label>
                <Input
                  required
                  type="text"
                  value={currentField.fieldName || ""}
                  onChange={(e) => setCurrentField({ ...currentField, fieldName: e.target.value })}
                  placeholder="firstName"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-secondary">Label</label>
                <Input
                  required
                  type="text"
                  value={currentField.label || ""}
                  onChange={(e) => setCurrentField({ ...currentField, label: e.target.value })}
                  placeholder="First Name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-secondary">Placeholder</label>
                <Input
                  type="text"
                  value={currentField.placeholder || ""}
                  onChange={(e) => setCurrentField({ ...currentField, placeholder: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-secondary">Input Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={currentField.fieldType || "text"}
                  onChange={(e) => setCurrentField({ ...currentField, fieldType: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id="required"
                    className="w-4 h-4 rounded border-slate-300 text-primary"
                    checked={currentField.required || false}
                    onChange={(e) => setCurrentField({ ...currentField, required: e.target.checked })}
                  />
                  <label htmlFor="required" className="text-sm font-semibold text-secondary cursor-pointer">Required</label>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-secondary">Display Order</label>
                  <Input
                    type="number"
                    value={currentField.displayOrder ?? 0}
                    onChange={(e) => setCurrentField({ ...currentField, displayOrder: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsFieldModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
