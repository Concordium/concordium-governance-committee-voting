import Home from '@pages/Home';
import { WalletConnection } from './WalletConnection';
import { Container } from 'react-bootstrap';

function App() {
    return (
        <Container className="mt-4">
            <header className="d-flex justify-content-end mb-4">
                <WalletConnection />
            </header>
            <main>
                <Home />
            </main>
        </Container>
    );
}

export default App;
