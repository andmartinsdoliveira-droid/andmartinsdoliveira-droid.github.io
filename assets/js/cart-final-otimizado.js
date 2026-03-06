/**
 * SISTEMA DE CARRINHO - LOJA EDUCACIONAL (FRONTEND)
 * Versão: 7.0 - Otimizado para Backend com Proxy para Make.com
 * Data: Março 2026
 *
 * FUNCIONAMENTO:
 * 1. Gerencia o carrinho de compras no navegador do cliente.
 * 2. Ao finalizar, envia APENAS os itens do carrinho para o backend (Google Apps Script).
 * 3. O backend atua como um proxy: repassa os dados para o Make.com, que cria a preferência
 *    de pagamento no PagBank e retorna o link.
 * 4. Este script recebe o link de pagamento do backend e redireciona o cliente.
 */

// ==================== CONFIGURAÇÕES DO FRONTEND ====================
const CartConfig = {
  // Chave para salvar o carrinho no navegador do cliente
  STORAGE_KEY: 'materiaisdaprofe_carrinho',

  // URL para buscar a lista completa de produtos (usado se a variável 'window.produtos' não existir)
  PRODUCTS_DATA_URL: 'https://script.google.com/macros/s/AKfycbxePs6JdZksbIGZ7SsbqxNOuZ0f9asF1-LdNJsDWDPZTc4zjpCN_Kb6aelvlUexiDk9dA/exec',

  // URL DO SEU BACKEND (Google Apps Script ) que irá receber os itens e contatar o Make.com
  CHECKOUT_BACKEND_URL: 'https://script.google.com/macros/s/AKfycbwwitW4-7_4kDSTd1jGRLszbdiAlcv7Twp99hCxgAIzqsiTnDdQfGCxUQr0RxlG5wpKaQ/exec',

  // Quantidade máxima de um mesmo item no carrinho (1 para evitar duplicatas )
  MAX_QUANTITY_PER_ITEM: 1,
};

// ==================== CLASSE PRINCIPAL DO CARRINHO ====================

class ShoppingCart {
  constructor() {
    this.items = this.loadFromStorage();
    this.isModalOpen = false;
    this.init();
  }

  init() {
    this.updateCounter();
    this.bindEvents();
    const carrinhoModal = document.getElementById('carrinhoModal');
    if (carrinhoModal) {
      carrinhoModal.style.display = 'none';
    }
    document.body.style.overflow = '';
  }

  bindEvents() {
    document.getElementById('carrinhoBtn')?.addEventListener('click', () => this.toggleCart());
    document.getElementById('fecharCarrinho')?.addEventListener('click', () => this.closeCart());
    document.getElementById('limparCarrinho')?.addEventListener('click', () => this.clearCart());
    document.getElementById('finalizarCompra')?.addEventListener('click', () => this.processCheckout());

    const modal = document.getElementById('carrinhoModal');
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closeCart();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen) this.closeCart();
    });
  }

  // MANTIDO COMO ORIGINAL: Adiciona o item com o preço em formato decimal (ex: 8.00)
  addItem(produto) {
    if (!produto || !produto.ID) {
      this.showNotification('Erro: Produto inválido', 'error');
      return false;
    }
    if (this.items.some(item => item.id == produto.ID)) {
      this.showNotification(`${produto.Nome} já está no carrinho!`, 'warning');
      return false;
    }
    const newItem = {
      id: produto.ID,
      name: produto.Nome,
      // O preço é armazenado como um número decimal normal
      unit_price: this.parsePriceToNumber(produto.Preço),
      quantity: 1,
      image: produto.URL_Imagem || produto.Imagens?.[0] || '',
      pdf_url: produto.LinkS3 || ''
    };
    this.items.push(newItem);
    this.saveToStorage();
    this.updateCounter();
    this.showNotification(`${produto.Nome} adicionado ao carrinho!`, 'success');
    return true;
  }

  removeItem(productId) {
    const index = this.items.findIndex(item => item.id == productId);
    if (index > -1) {
      const removedItem = this.items.splice(index, 1)[0];
      this.saveToStorage();
      this.updateCounter();
      this.renderCartItems();
      this.showNotification(`${removedItem.name} removido do carrinho`, 'info');
    }
  }

  updateQuantity(productId, quantity) {
    const item = this.items.find(item => item.id == productId);
    if (item) {
      item.quantity = Math.min(Math.max(1, parseInt(quantity) || 1), CartConfig.MAX_QUANTITY_PER_ITEM);
      this.saveToStorage();
      this.renderCartItems();
    }
  }

  clearCart() {
    if (this.items.length === 0) {
      this.showNotification('O carrinho já está vazio', 'info');
      return;
    }
    if (confirm('Tem certeza que deseja limpar o carrinho?')) {
      this.items = [];
      this.saveToStorage();
      this.updateCounter();
      this.renderCartItems();
      this.showNotification('Carrinho limpo!', 'info');
    }
  }

  getTotalItems() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  // MANTIDO COMO ORIGINAL: O cálculo do total continua com decimais
  getTotalValue() {
    return this.items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  }

  toggleCart() {
    this.isModalOpen ? this.closeCart() : this.openCart();
  }

  openCart() {
    const modal = document.getElementById('carrinhoModal');
    if (modal) {
      this.renderCartItems();
      modal.style.display = 'flex';
      this.isModalOpen = true;
      document.body.style.overflow = 'hidden';
    }
  }

  closeCart() {
    const modal = document.getElementById('carrinhoModal');
    if (modal) {
      modal.style.display = 'none';
      this.isModalOpen = false;
      document.body.style.overflow = '';
    }
  }

  renderCartItems() {
    const container = document.getElementById('carrinhoItens');
    const emptyContainer = document.getElementById('carrinhoVazio');
    const totalElement = document.getElementById('valorTotal');
    const paymentButton = document.getElementById('finalizarCompra');

    if (!container) return;

    const hasItems = this.items.length > 0;
    if (emptyContainer) emptyContainer.style.display = hasItems ? 'none' : 'block';
    if (paymentButton) paymentButton.disabled = !hasItems;

    if (hasItems) {
      container.innerHTML = this.items.map(item => `
        <div class="carrinho-item" data-id="${item.id}">
          <div class="carrinho-item-imagem">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" onerror="this.parentElement.innerHTML='📚'"/>` : '📚'}
          </div>
          <div class="carrinho-item-info">
            <h4 class="carrinho-item-titulo">${this.escapeHtml(item.name)}</h4>
            <div class="carrinho-item-preco">${this.formatPrice(item.unit_price)}</div>
          </div>
          <div class="carrinho-item-controles">
            <button class="remover-item-btn" onclick="cart.removeItem(${item.id})" title="Remover item">🗑️</button>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '';
    }

    if (totalElement) {
      totalElement.textContent = this.formatPrice(this.getTotalValue()).replace('R$ ', '');
    }
  }

  updateCounter() {
    const counter = document.getElementById('carrinhoContador');
    if (counter) {
      const totalItems = this.getTotalItems();
      counter.textContent = totalItems;
      counter.style.display = totalItems > 0 ? 'flex' : 'none';
    }
  }

  /**
   * MODIFICADO: Processa o Checkout convertendo os valores para centavos
   * ANTES de enviar para o backend.
   */
  async processCheckout() {
    if (this.items.length === 0) {
      this.showNotification('Seu carrinho está vazio.', 'warning');
      return;
    }

    const btn = document.getElementById('finalizarCompra');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Abrindo pagamento...';

    try {
      // Cria uma cópia dos itens e converte o preço para centavos
      const itemsInCents = this.items.map(item => ({
        ...item,
        unit_amount: Math.round(item.unit_price * 100) // Converte para centavos e arredonda
        // delete item.unit_price; // Opcional: remove a chave original se a API for estrita
      }));

      // Prepara o payload com os itens no formato de centavos
      const payload = {
        items: itemsInCents,
        currency: 'BRL'
      };

      console.log("📤 Enviando payload para o backend (preços em centavos):", payload);

      const response = await fetch(CartConfig.CHECKOUT_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`O servidor respondeu com um erro (HTTP ${response.status})`);
      }

      const result = await response.json();
      console.log("📥 Resposta do backend recebida:", result);

      const paymentUrl = result.payment_url || result.paymentLink || result.init_point || result.url;

      if (paymentUrl && typeof paymentUrl === 'string') {
        console.log("🔗 Redirecionando para o Pagamento:", paymentUrl);
        this.items = [];
        this.saveToStorage();
        this.updateCounter();
        window.location.href = paymentUrl;
      } else {
        throw new Error(result.error || "Link de pagamento não foi retornado pelo servidor.");
      }

    } catch (error) {
      console.error("❌ Erro no processo de checkout:", error);
      this.showNotification(error.message || "Não foi possível iniciar o pagamento. Tente novamente.", 'error');
      btn.disabled = false;
      btn.textContent = 'Ir para Pagamento';
    }
  }

  // ==================== FUNÇÕES UTILITÁRIAS (MANTIDAS COMO NO ORIGINAL) ====================

  saveToStorage() {
    try {
      localStorage.setItem(CartConfig.STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.error('Erro ao salvar carrinho no localStorage:', e);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(CartConfig.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Erro ao carregar carrinho do localStorage:', e);
      return [];
    }
  }

  // MANTIDO COMO ORIGINAL: Formata o preço a partir de um número decimal
  formatPrice(price) {
    return `R$ ${(parseFloat(price) || 0).toFixed(2).replace('.', ',')}`;
  }

  // MANTIDO COMO ORIGINAL: Converte string de preço para número decimal
  parsePriceToNumber(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    const str = String(valor).trim().replace(',', '.').replace(/[^0-9.]/g, '');
    return parseFloat(str) || 0;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    document.querySelectorAll(".cart-notification").forEach(n => n.remove());
    const notification = document.createElement("div");
    notification.className = `cart-notification cart-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }
}


// ==================== INICIALIZAÇÃO E FUNÇÕES GLOBAIS ====================
let cart;
document.addEventListener('DOMContentLoaded', () => {
  cart = new ShoppingCart();
  window.cart = cart; // Expondo para o escopo global para fácil acesso (ex: onclick)
});

// Função global para adicionar itens, buscando dados do produto se necessário
window.adicionarAoCarrinho = async (produtoId) => {
  if (!window.produtos || window.produtos.length === 0) {
    try {
      const response = await fetch(CartConfig.PRODUCTS_DATA_URL);
      if (!response.ok) throw new Error('Falha ao carregar produtos.');
      window.produtos = await response.json();
    } catch (error) {
      cart?.showNotification('Erro ao carregar lista de produtos. Tente novamente.', 'error');
      return;
    }
  }
  const produto = window.produtos.find(p => p.ID == produtoId);
  if (produto) {
    cart.addItem(produto);
  } else {
    cart?.showNotification('Produto não encontrado.', 'error');
  }
};

// Funções globais para controle do carrinho
window.abrirCarrinho = () => cart?.openCart();
window.fecharCarrinho = () => cart?.closeCart();

// ==================== ESTILOS CSS (ESSENCIAIS) ====================
const cartStyles = document.createElement('style');
cartStyles.textContent = `
  /* Estilos do modal, itens, botões e notificações. Copie os estilos da sua versão anterior aqui. */
  .modal-content { height: 90vh; display: flex; flex-direction: column; }
  .modal-body { flex: 1; overflow-y: auto; }
  .modal-footer { padding: 1rem; border-top: 1px solid #eee; background: #fff; }
  .carrinho-item { display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid #e5e7eb; align-items: center; }
  .carrinho-item-imagem { width: 60px; height: 60px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border-radius: 8px; font-size: 1.5rem; }
  .carrinho-item-imagem img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
  .carrinho-item-info { flex: 1; min-width: 0; }
  .carrinho-item-titulo { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem 0; }
  .carrinho-item-descricao { font-size: 0.875rem; color: #6b7280; margin: 0 0 0.5rem 0; }
  .carrinho-item-preco { font-weight: 600; color: #059669; }
  .remover-item-btn { background: #fee2e2; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer; margin-left: auto; }
  .checkout-total { text-align: center; padding: 1rem; background: #f9fafb; border-radius: 8px; margin-bottom: 1rem; font-size: 1.125rem; }
  .cart-notification { position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 400px; padding: 1rem; border-radius: 8px; color: white; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .cart-notification-success { background-color: #10b981; }
  .cart-notification-error { background-color: #ef4444; }
  .cart-notification-warning { background-color: #f59e0b; }
  .cart-notification-info { background-color: #3b82f6; }
`;
document.head.appendChild(cartStyles);
