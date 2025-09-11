// Cardano WASM loader for popup context
class Loader {
  private _initialized = false;
  private _cardanoWasm: any = null;

  async load(): Promise<void> {
    if (this._initialized) return;

    try {
      // Use browser version since we're in popup context with window object
      this._cardanoWasm = await import('@emurgo/cardano-serialization-lib-browser');
      this._initialized = true;
      console.log('Cardano WASM loaded successfully in popup context');
    } catch (error) {
      console.error('Failed to initialize Cardano WASM:', error);
      throw new Error(`Failed to initialize Cardano WASM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  get Cardano() {
    if (!this._initialized || !this._cardanoWasm) {
      throw new Error('WASM not initialized. Call load() first.');
    }
    return this._cardanoWasm;
  }
}

export const CardanoLoader = new Loader();
