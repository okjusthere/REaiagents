export interface ClientConfig {
    name: string;
    email: string;
    style: 'professional' | 'casual' | 'investor' | 'mythbuster';
}

// Default example clients — replace with your actual client list
const clients: ClientConfig[] = [
    {
        name: '示例客户A',
        email: 'clientA@example.com',
        style: 'professional',
    },
    {
        name: '示例客户B',
        email: 'clientB@example.com',
        style: 'casual',
    },
    {
        name: '示例客户C',
        email: 'clientC@example.com',
        style: 'investor',
    },
    {
        name: '示例客户D',
        email: 'clientD@example.com',
        style: 'mythbuster',
    },
];

export default clients;
