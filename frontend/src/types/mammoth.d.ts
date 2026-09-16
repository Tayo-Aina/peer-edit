declare module 'mammoth' {
  export interface MammothMessage {
    type: 'warning' | 'error';
    message: string;
    error?: unknown;
  }
  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }
  export interface MammothArrayBufferInput {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    convertToHtml(
      input: MammothArrayBufferInput,
      options?: Record<string, unknown>,
    ): Promise<MammothResult>;
    extractRawText(input: MammothArrayBufferInput): Promise<MammothResult>;
  };
  export default mammoth;
}
