import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ... (config do firebase continua a mesma) ...

document.getElementById('import-btn').addEventListener('click', async () => {
    // ... (início da função continua o mesmo) ...
    
    reader.onload = async (event) => {
        try {
            // ... (lógica de leitura do arquivo continua a mesma) ...

            productElements.forEach(row => {
                // ... (lógica de extração de dados da linha continua a mesma) ...

                const productData = {
                    name: name,
                    barcode: cells[0]?.innerText.trim() || '',
                    sellPrice: parseFloat(cells[4]?.innerText.replace(',', '.').trim() || '0'),
                    costPrice: parseFloat(cells[6]?.innerText.replace(',', '.').trim() || '0'),
                    quantity: parseInt(cells[7]?.innerText.trim() || '0'),
                };
                
                // --- AQUI ESTÁ A MUDANÇA ---
                // Salva na coleção global "products"
                const productRef = doc(collection(db, "products"));
                batch.set(productRef, productData);
                importedCount++;
            });

            await batch.commit();
            statusDiv.innerHTML = `<p class="text-green-500">Sucesso! ${importedCount} produtos foram importados para o estoque compartilhado.</p>`;
        } catch (error) {
            console.error("Erro ao importar:", error);
            statusDiv.innerHTML = `<p class="text-red-500">Erro: ${error.message}</p>`;
        }
    };
    reader.readAsText(file);
});
