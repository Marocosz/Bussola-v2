// Escreve na área de transferência e diz se deu certo. O Safari/iOS rejeita a escrita fora de
// um gesto do usuário (ex.: num timer), então quem chama precisa olhar o resultado antes de
// afirmar qualquer coisa ao usuário.
export async function escreverClipboard(texto) {
    try {
        if (!navigator.clipboard?.writeText) return false;
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        return false;
    }
}
