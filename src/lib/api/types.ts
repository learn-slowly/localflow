// 공통 API 응답 타입

export interface DataGoKrResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: T[];
      totalCount: number;
      pageNo: number;
      numOfRows: number;
    };
  };
}

export interface TransitResponse<T> {
  count: number;
  status: string; // "OK" | "NOT_FOUND" | "ERROR"
  result: T[];
}

export interface SafetyDataResponse<T> {
  header: {
    resultCode: string;
    resultMsg: string;
  };
  body: T[];
  totalCount: number;
}
