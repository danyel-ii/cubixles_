import msgpack from 'msgpack-lite'
import { v4 as uuidv4 } from 'uuid'
import { Events } from './Events.js'
import { Game } from './Game.js'

export class Server
{
    constructor()
    {
        this.game = Game.getInstance()

        // Unique session ID
        this.uuid = localStorage.getItem('uuid')
        if(!this.uuid)
        {
            this.uuid = uuidv4()
            localStorage.setItem('uuid', this.uuid)
        }

        this.connected = false
        this.mode = null
        this.httpBase = import.meta.env.VITE_SERVER_HTTP_URL || '/api/what-it-do'
        this.httpPollInterval = null
        this.httpWhisperIds = null
        this.initData = null
        this.events = new Events()
        document.documentElement.classList.add('is-server-offline')
    }

    start()
    {
        if(import.meta.env.VITE_SERVER_URL)
        {
            this.mode = 'ws'
            // First connect attempt
            this.connect()
            
            // Try connect
            setInterval(() =>
            {
                if(!this.connected)
                    this.connect()
            }, 2000)
        }
        else if(this.httpBase)
        {
            this.mode = 'http'
            this.connectHttp()
        }
    }

    connectHttp()
    {
        this.connected = true
        document.documentElement.classList.remove('is-server-offline')
        document.documentElement.classList.add('is-server-online')
        this.events.trigger('connected')

        this.fetchInit()
        this.httpPollInterval = setInterval(() =>
        {
            this.fetchInit()
        }, 15000)
    }

    fetchInit()
    {
        fetch(`${this.httpBase}/init`, { credentials: 'same-origin' })
            .then((response) => response.ok ? response.json() : null)
            .then((data) =>
            {
                if(!data)
                    return
                this.handleHttpMessage(data)
            })
            .catch(() => {})
    }

    connect()
    {
        this.socket = new WebSocket(import.meta.env.VITE_SERVER_URL)
        this.socket.binaryType = 'arraybuffer'

        this.socket.addEventListener('open', () =>
        {
            this.connected = true
            document.documentElement.classList.remove('is-server-offline')
            document.documentElement.classList.add('is-server-online')
            this.events.trigger('connected')

            // On message
            this.socket.addEventListener('message', (message) =>
            {
                this.onReceive(message)
            })

            // Notification (only if been running for a while)
            if(this.game.ticker.elapsed > 10)
            {
                const html = /* html */`
                    <div class="top">
                        <div class="title">Server connected</div>
                    </div>
                `

                this.game.notifications.show(
                    html,
                    'server-connected',
                    8,
                    null,
                    'server-connected'
                )
            }

            // On close
            this.socket.addEventListener('close', () =>
            {
                document.documentElement.classList.add('is-server-offline')
                document.documentElement.classList.remove('is-server-online')
                this.connected = false

                // Notification
                const html = /* html */`
                    <div class="top">
                        <div class="title">Server disconnected</div>
                    </div>
                `

                this.game.notifications.show(
                    html,
                    'server-disconnected',
                    8,
                    null,
                    'server-disconnected'
                )
                
                this.events.trigger('disconnected')
            })
        })
    }

    onReceive(message)
    {
        const data = this.decode(message.data)
    
    
        if(this.initData === null)
            this.initData = data

        this.events.trigger('message', [ data ])
    }

    send(message)
    {
        if(!this.connected)
            return false

        if(this.mode === 'http')
        {
            this.sendHttp(message)
            return true
        }

        this.socket.send(this.encode({ uuid: this.uuid, ...message }))
    }

    sendHttp(message)
    {
        const payload = { uuid: this.uuid, ...message }
        let endpoint = null

        if(message.type === 'whispersInsert')
            endpoint = 'whispers'
        else if(message.type === 'circuitInsert')
            endpoint = 'circuit'
        else if(message.type === 'cataclysmInsert')
            endpoint = 'cataclysm'
        
        if(!endpoint)
            return

        fetch(`${this.httpBase}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'same-origin'
        })
            .then((response) => response.ok ? response.json() : null)
            .then((data) =>
            {
                if(!data)
                    return
                this.handleHttpMessage(data)
            })
            .catch(() => {})
    }

    handleHttpMessage(data)
    {
        if(Array.isArray(data?.messages))
        {
            for(const message of data.messages)
                this.handleHttpMessage(message)
            return
        }

        if(!data || !data.type)
            return

        if(data.type === 'init' && Array.isArray(data.whispers))
        {
            const newIds = new Set(data.whispers.map((item) => item.id))
            if(this.httpWhisperIds)
            {
                const deleted = []
                for(const id of this.httpWhisperIds)
                {
                    if(!newIds.has(id))
                        deleted.push({ id })
                }
                if(deleted.length)
                    this.events.trigger('message', [ { type: 'whispersDelete', whispers: deleted } ])
            }
            this.httpWhisperIds = newIds
        }

        if(this.initData === null && data.type === 'init')
            this.initData = data

        if(data.type === 'whispersInsert' && Array.isArray(data.deleted) && data.deleted.length)
            this.events.trigger('message', [ { type: 'whispersDelete', whispers: data.deleted } ])

        this.events.trigger('message', [ data ])
    }

    decode(data)
    {
        return msgpack.decode(new Uint8Array(data))
    }

    encode(data)
    {
        return msgpack.encode(data)
    }
}
