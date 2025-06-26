const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findFirstBlockWithTx() {
    try {
        console.log(`Starting search for the first block with transactions...`);

        // We don't know the latest block, so we'll just search a high number.
        for (let i = 2; i < 99999999; i++) {
            const blockNumberHex = '0x' + i.toString(16);
            const response = await fetch('http://localhost:3001', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: i,
                    method: 'eth_getBlockByNumber',
                    params: [blockNumberHex, false],
                }),
            });

            const data = await response.json();

            if (data.error) {
                // If we hit a block that doesn't exist yet, we've reached the end.
                console.log('\nReached the end of the chain. No transactions found in any blocks.');
                return;
            }

            if (data.result && data.result.transactions.length > 0) {
                console.log(`\nSuccess! The first block that contains transactions is Block #${i}.`);
                return;
            }
            
            if (i > 0 && i % 50 === 0) {
                 process.stdout.write(`...searched up to block ${i}\r`);
            }
            
            await sleep(200); // Increased delay just to be safe
        }
    } catch (error) {
        console.error('An error occurred while searching:', error.message);
    }
}

findFirstBlockWithTx(); 