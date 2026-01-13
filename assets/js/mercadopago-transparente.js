/**
 * INTEGRAÇÃO MERCADO PAGO TRANSPARENTE
 * Esta implementação utiliza o Brick de Pagamentos do Mercado Pago para um checkout transparente.
 */

class MercadoPagoTransparente {
    constructor(publicKey) {
        this.mp = new MercadoPago(publicKey, {
            locale: 'pt-BR'
        });
        this.bricksBuilder = this.mp.bricks();
        this.paymentBrickController = null;
    }

    async renderPaymentBrick(containerId, amount, items, customerData, callbacks) {
        const settings = {
            initialization: {
                amount: amount, // valor total a pagar
                payer: {
                    firstName: customerData.name.split(' ')[0],
                    lastName: customerData.name.split(' ').slice(1).join(' '),
                    email: customerData.email,
                },
            },
            customization: {
                paymentMethods: {
                    ticket: "all",
                    bankTransfer: "all",
                    creditCard: "all",
                    debitCard: "all",
                    mercadoPago: "all",
                },
            },
            callbacks: {
                onReady: () => {
                    console.log('Brick de pagamento pronto');
                    if (callbacks.onReady) callbacks.onReady();
                },
                onSubmit: async ({ selectedPaymentMethod, formData }) => {
                    // Aqui enviamos os dados para o backend (Make.com ou Apps Script)
                    return new Promise((resolve, reject) => {
                        fetch(callbacks.webhookUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                ...formData,
                                items: items,
                                customer: customerData,
                                paymentMethod: selectedPaymentMethod
                            }),
                        })
                        .then((response) => response.json())
                        .then((result) => {
                            if (result.status === 'approved' || result.status === 'pending') {
                                resolve();
                                if (callbacks.onSuccess) callbacks.onSuccess(result);
                            } else {
                                reject();
                                if (callbacks.onError) callbacks.onError(result);
                            }
                        })
                        .catch((error) => {
                            reject();
                            if (callbacks.onError) callbacks.onError(error);
                        });
                    });
                },
                onError: (error) => {
                    console.error('Erro no Brick de pagamento:', error);
                    if (callbacks.onError) callbacks.onError(error);
                },
            },
        };

        this.paymentBrickController = await this.bricksBuilder.create(
            'payment',
            containerId,
            settings
        );
    }

    unmount() {
        if (this.paymentBrickController) {
            this.paymentBrickController.unmount();
        }
    }
}

window.MercadoPagoTransparente = MercadoPagoTransparente;
