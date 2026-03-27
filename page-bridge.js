(() => {
    if (window.__poketwoBridgeInstalled) {
        return;
    }

    window.__poketwoBridgeInstalled = true;

    function callExt(command, args) {
        const id = 'poketwo_' + Date.now() + '_' + Math.random().toString(16).slice(2);

        return new Promise((resolve, reject) => {
            const onResult = (event) => {
                const detail = event?.detail || {};
                if (detail.id !== id) {
                    return;
                }

                window.removeEventListener('__poketwo_ext_result', onResult);

                if (detail.error) {
                    reject(new Error(detail.error));
                    return;
                }

                resolve(detail.result);
            };

            window.addEventListener('__poketwo_ext_result', onResult);
            window.dispatchEvent(new CustomEvent('__poketwo_ext_call', {
                detail: { id, command, args }
            }));
        });
    }

    window.poketwoTestSend = (message = 'hello') => callExt('testSend', [message]);
    window.poketwoTestCatch = (pokemonName = 'pikachu') => callExt('testCatch', [pokemonName]);
    window.poketwoTestGetId = () => callExt('testGetId', []);
})();
