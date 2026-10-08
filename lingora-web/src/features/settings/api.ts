import { apiRequest } from '../../api/client';

export type MasterResource =
  | 'languages'
  | 'levels'
  | 'countries'
  | 'country-languages'
  | 'courses'
  | 'modules'
  | 'lessons'
  | 'enrollments'
  | 'progress';

export type MasterFieldKind = 'string' | 'number' | 'boolean' | 'json' | 'date';

export type MasterReference = {
  resource: string;
  label: string;
};

export type MasterReferenceOption = {
  id: string;
  label: string;
  description?: string;
};

export type MasterField = {
  name: string;
  kind: MasterFieldKind;
  nullable: boolean;
  requiredOnCreate: boolean;
  editable: boolean;
  creatable: boolean;
  defaultValue?: unknown;
  reference?: MasterReference;
};

export type MasterReferences = Record<string, MasterReferenceOption[]>;

export type MasterRow = Record<string, unknown> & { id?: string };
export type MasterChange = { id: string; values: Record<string, unknown> };

export const settingsApi = {
  listMaster: (resource: MasterResource) =>
    apiRequest<{
      resource: MasterResource;
      fields: MasterField[];
      rows: MasterRow[];
      references: MasterReferences;
    }>(`/admin/master/${resource}`),
  createMaster: (resource: MasterResource, values: Record<string, unknown>) =>
    apiRequest<{ row: MasterRow }>(`/admin/master/${resource}`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    }),
  updateMaster: (resource: MasterResource, id: string, values: Record<string, unknown>) =>
    apiRequest<{ row: MasterRow }>(`/admin/master/${resource}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ values }),
    }),
  batchUpdateMaster: (resource: MasterResource, rows: MasterChange[]) =>
    apiRequest<{ rows: MasterRow[] }>(`/admin/master/${resource}/batch`, {
      method: 'PATCH',
      body: JSON.stringify({ rows }),
    }),
  deleteMaster: (resource: MasterResource, id: string) =>
    apiRequest<{ deleted: true; id: string }>(`/admin/master/${resource}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
