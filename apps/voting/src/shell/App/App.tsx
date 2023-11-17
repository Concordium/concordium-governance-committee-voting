import Home from '@pages/Home';
import { WalletConnection } from './WalletConnection';

function App() {
    return (
        <>
            <header className="d-flex justify-content-end mb-4">
                <WalletConnection />
            </header>
            <main>
                <Home />
            </main>
        </>
    );
}

export default App;
