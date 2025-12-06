export interface paginatedData {
    data:any
    totalSize:number
}


export type Item = {
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    serialNos: string[];
};

export type DetailedGatePass = {
    gatepassid: string;
    customername: string;
    issuedAt: string;
    validUntil: string | null;
    status: 'pending' | 'approved' | 'rejected';
    gatepassnotes: string | null;
    location: string;
    vehicleNo: string;
    storeIncharge: string;
    signature: string | null;
    items: Item[];
};
