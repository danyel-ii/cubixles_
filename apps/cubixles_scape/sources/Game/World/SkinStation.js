import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { cubeSkins } from '../../data/cubeSkins.js'

export class SkinStation
{
    constructor()
    {
        this.game = Game.getInstance()

        this.skins = []
        this.fallbackSkins = cubeSkins
        this.textureLoader = this.game.resourcesLoader.getLoader('texture')
        this.textureCache = new Map()
        this.skinCache = new Map()
        this.index = 0

        this.setAnchor()
        this.registerRespawn()
        this.setStation()
        this.setInteractivePoint()
        this.loadMintedSkins()
    }

    setAnchor()
    {
        const fallback = this.game.respawns?.getByName('landing')?.position?.clone() || new THREE.Vector3()
        const careerSpawn = this.game.respawns?.getByName('career')?.position?.clone()
        const labSpawn = this.game.respawns?.getByName('lab')?.position?.clone()
        const careerArea = this.game.world?.areas?.career?.model?.position?.clone()
        const labArea = this.game.world?.areas?.lab?.model?.position?.clone()

        if(careerSpawn && labSpawn)
        {
            this.anchor = careerSpawn.lerp(labSpawn, 0.5)
        }
        else if(careerArea && labArea)
        {
            this.anchor = careerArea.lerp(labArea, 0.5)
        }
        else
        {
            this.anchor = fallback
        }

        this.anchor.x -= 14
        this.anchor.z -= 16
        this.anchor.y = this.game.water.surfaceElevation + 0.15
    }

    registerRespawn()
    {
        if(!this.game.respawns?.items)
            return

        const name = 'skins'
        if(this.game.respawns.items.has(name))
            return

        this.game.respawns.items.set(name, {
            name,
            position: new THREE.Vector3(this.anchor.x, 4, this.anchor.z),
            rotation: 0
        })
    }

    async loadMintedSkins()
    {
        try
        {
            const data = await this.fetchMintedTokens()
            const tokens = Array.isArray(data?.tokens) ? data.tokens : []
            const mintedSkins = this.buildSkinsFromTokens(tokens)

            this.skins = mintedSkins.length ? mintedSkins : this.fallbackSkins
            if(mintedSkins.length)
                console.info(`[SkinStation] Loaded ${mintedSkins.length} minted skins.`)
        }
        catch(error)
        {
            this.skins = this.fallbackSkins
            console.warn('[SkinStation] Falling back to local skins.', error)
        }

        if(this.skins.length)
        {
            this.index = -1
        }
    }

    async fetchMintedTokens()
    {
        const baseUrls = this.getShaolinBaseUrls()
        let lastError = null

        for(const baseUrl of baseUrls)
        {
            if(!baseUrl)
                continue

            const normalized = baseUrl.replace(/\/$/, '')
            const url = `${normalized}/api/poc/tokens?all=true&limit=100&maxPages=10`

            try
            {
                const response = await fetch(url)
                if(!response.ok)
                    throw new Error(`Token fetch failed: ${response.status}`)

                return await response.json()
            }
            catch(error)
            {
                lastError = error
            }
        }

        if(lastError)
            throw lastError

        throw new Error('Token fetch failed')
    }

    getShaolinBaseUrls()
    {
        const urls = []
        const envBase = import.meta.env.VITE_SHAOLIN_BASE_URL
        if(envBase)
            urls.push(envBase)

        if(typeof window !== 'undefined' && window.location?.origin)
            urls.push(window.location.origin)

        urls.push('https://cubixles.xyz')
        urls.push('https://www.cubixles.xyz')
        urls.push('http://localhost:3000')

        return urls
    }

    buildSkinsFromTokens(tokens)
    {
        return tokens.map((token) =>
        {
            const tokenId = token.tokenId || token.token_id || token.id || token.tokenIdNumber || token.token_id_number
            const label = token.title || token.name || (tokenId ? `Cubixles #${tokenId}` : 'Cubixles')
            const metadata = token.metadata?.resolved || token.metadata?.raw || token.metadata || {}
            const facesSource = metadata?.properties?.faces || metadata?.faces || metadata?.properties?.refsFaces || metadata?.refsFaces
            const faceUrls = this.extractFaceUrls(facesSource)
            const primaryUrl = this.extractMediaUrl(token, metadata) || faceUrls[0]

            if(!primaryUrl && !faceUrls.length)
                return null

            const faces = faceUrls.length ? this.normalizeFaces(faceUrls, primaryUrl) : null

            return {
                id: tokenId ? `token-${tokenId}` : `token-${Math.random().toString(16).slice(2)}`,
                label,
                url: primaryUrl,
                faces: faces || undefined
            }
        }).filter(Boolean)
    }

    extractFaceUrls(source)
    {
        if(!source)
            return []

        const records = Array.isArray(source) ? source : Object.values(source)
        const urls = []

        for(const entry of records)
        {
            if(!entry || typeof entry !== 'object')
                continue

            const candidate = entry.image || entry.image_url || entry.imageUrl || entry.url || entry.uri || entry.gateway || entry.raw || entry.imageURI || entry.imageUri
            const normalized = this.normalizeUrl(candidate)
            if(normalized)
                urls.push(normalized)
        }

        return urls
    }

    extractMediaUrl(token, metadata)
    {
        if(Array.isArray(token?.media) && token.media.length)
        {
            for(const media of token.media)
            {
                const candidate = media?.gateway || media?.raw || media?.thumbnail
                const normalized = this.normalizeUrl(candidate)
                if(normalized)
                    return normalized
            }
        }

        const metadataImage = metadata?.image || metadata?.image_url || metadata?.imageUrl || metadata?.imageURI || metadata?.imageUri
        const normalizedMetadata = this.normalizeUrl(metadataImage)
        if(normalizedMetadata)
            return normalizedMetadata

        const tokenUri = token?.tokenUri?.gateway || token?.tokenUri?.raw
        return this.normalizeUrl(tokenUri)
    }

    normalizeFaces(faceUrls, fallback)
    {
        const urls = faceUrls.filter(Boolean)
        if(!urls.length && fallback)
            return Array(6).fill(fallback)

        const filled = []
        for(let i = 0; i < 6; i++)
        {
            filled.push(urls[i % urls.length])
        }
        return filled
    }

    normalizeUrl(value)
    {
        if(!value || typeof value !== 'string')
            return null

        if(value.startsWith('ipfs://ipfs/'))
            return `https://ipfs.io/${value.replace('ipfs://', '')}`

        if(value.startsWith('ipfs://'))
            return `https://ipfs.io/ipfs/${value.replace('ipfs://', '')}`

        return value
    }

    setStation()
    {
        this.group = new THREE.Group()
        this.group.name = 'skinStation'
        this.group.position.copy(this.anchor)

        const platformMat = new THREE.MeshStandardMaterial({ color: 0x2b2334, roughness: 0.85, metalness: 0.1 })
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x4b365b, roughness: 0.65, metalness: 0.2 })
        const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2eb4, emissive: 0xff2eb4, emissiveIntensity: 0.9 })

        const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.35, 32), platformMat)
        platform.position.y = 0.18
        this.group.add(platform)

        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 12, 48), rimMat)
        rim.rotation.x = Math.PI * 0.5
        rim.position.y = 0.42
        this.group.add(rim)

        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.9, 18), rimMat)
        pedestal.position.y = 0.85
        this.group.add(pedestal)

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), beaconMat)
        beacon.position.y = 1.4
        this.group.add(beacon)

        this.screenMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.95
        })
        this.screenMaterial.userData.prevent = true

        const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), this.screenMaterial)
        screen.position.set(0, 1.25, -1.1)
        screen.rotation.y = Math.PI
        this.group.add(screen)

        this.object = this.game.objects.add(
            {
                model: this.group,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true
            },
            {
                type: 'fixed',
                friction: 0.7,
                restitution: 0.1,
                position: this.group.position,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ 2.4, 0.25, 2.4 ],
                        position: { x: 0, y: 0.18, z: 0 },
                        category: 'floor'
                    }
                ]
            }
        )
    }

    setInteractivePoint()
    {
        const pointPosition = this.group.position.clone()
        pointPosition.y += 1.2

        this.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            'Skins',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.cycleSkin()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    cycleSkin()
    {
        if(!this.skins.length)
            return

        this.index = (this.index + 1) % this.skins.length
        this.applySkin(this.index)
    }

    async applySkin(index)
    {
        const skin = this.skins[index]
        if(!skin)
            return

        const cached = this.skinCache.get(skin.id)
        const cacheEntry = cached || await this.buildSkinMaterials(skin)

        if(!cached)
            this.skinCache.set(skin.id, cacheEntry)

        const vehicle = this.game.world?.visualVehicle
        if(vehicle?.setCubeSkin)
            vehicle.setCubeSkin(cacheEntry.materials)

        if(this.screenMaterial)
        {
            this.screenMaterial.map = cacheEntry.previewTexture
            this.screenMaterial.needsUpdate = true
        }
    }

    async buildSkinMaterials(skin)
    {
        const faceUrls = skin.faces && skin.faces.length ? skin.faces : Array(6).fill(skin.url)
        const textures = await Promise.all(faceUrls.map((url) => this.loadTexture(url)))

        const materials = textures.map((texture, index) =>
        {
            const faceTexture = this.prepareFaceTexture(texture, index)
            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.55,
                metalness: 0.1,
                transparent: true,
                opacity: 0.95,
                map: faceTexture
            })
            material.userData.prevent = true
            return material
        })

        return {
            materials,
            previewTexture: textures[0]
        }
    }

    prepareFaceTexture(texture, index)
    {
        if(!texture)
            return texture

        // BoxGeometry mirrors the back face UVs; flip U so the image reads outward.
        const shouldFlipU = index === 5
        if(!shouldFlipU)
            return texture

        const clone = texture.clone()
        clone.wrapS = THREE.RepeatWrapping
        clone.repeat.set(-1, 1)
        clone.offset.set(1, 0)
        clone.needsUpdate = true
        return clone
    }

    loadTexture(url)
    {
        if(this.textureCache.has(url))
            return Promise.resolve(this.textureCache.get(url))

        return new Promise((resolve, reject) =>
        {
            this.textureLoader.load(
                url,
                (texture) =>
                {
                    texture.colorSpace = THREE.SRGBColorSpace
                    texture.flipY = false
                    texture.minFilter = THREE.NearestFilter
                    texture.magFilter = THREE.NearestFilter
                    texture.generateMipmaps = false
                    texture.needsUpdate = true

                    this.textureCache.set(url, texture)
                    resolve(texture)
                },
                undefined,
                (error) =>
                {
                    reject(error)
                }
            )
        })
    }
}
