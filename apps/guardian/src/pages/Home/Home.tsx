import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Button, Container, Form, Row } from 'react-bootstrap';

function App() {
    const [greetMsg, setGreetMsg] = useState('');
    const [name, setName] = useState('');

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
        setGreetMsg(await invoke<string>('greet', { name }));
    }

    return (
        <Container fluid>
            <h1>Welcome to Tauri!</h1>
            <Row
                as={Form}
                onSubmit={(e) => {
                    e.preventDefault();
                    void greet();
                }}
            >
                <Form.Control onChange={(e) => setName(e.currentTarget.value)} placeholder="Enter a name..." />
                <Button type="submit">Greet</Button>
            </Row>

            <p>{greetMsg}</p>
        </Container>
    );
}

export default App;
