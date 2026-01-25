import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

export class LandingArea extends Area
{
    constructor(model)
    {
        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const lettersGroups = this.references.getStartingWith('letters')
        let references = this.references.items.get('letters') || []
        if(!references.length && lettersGroups.size)
            references = Array.from(lettersGroups.values()).flat()

        if(!references.length)
            return

        for(const reference of references)
        {
            const physical = reference.userData.object?.physical
            if(!physical || !physical.colliders?.[0])
                continue

            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            physical.colliders[0].setContactForceEventThreshold(5)
            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }

        const glyphs = {
            c: [
                '11110',
                '10000',
                '10000',
                '10000',
                '10000',
                '10000',
                '11110',
            ],
            u: [
                '10001',
                '10001',
                '10001',
                '10001',
                '10001',
                '10001',
                '01110',
            ],
            b: [
                '11110',
                '10001',
                '10001',
                '11110',
                '10001',
                '10001',
                '11110',
            ],
            i: [
                '11111',
                '00100',
                '00100',
                '00100',
                '00100',
                '00100',
                '11111',
            ],
            x: [
                '10001',
                '01010',
                '00100',
                '00100',
                '00100',
                '01010',
                '10001',
            ],
            l: [
                '10000',
                '10000',
                '10000',
                '10000',
                '10000',
                '10000',
                '11111',
            ],
            e: [
                '11111',
                '10000',
                '10000',
                '11110',
                '10000',
                '10000',
                '11111',
            ],
            s: [
                '01111',
                '10000',
                '10000',
                '01110',
                '00001',
                '00001',
                '11110',
            ],
            _: [
                '00000',
                '00000',
                '00000',
                '00000',
                '00000',
                '00000',
                '11111',
            ],
        }

        const text = 'cubixles_'
        const letters = [...text]

        const letterMaterial = new THREE.MeshStandardMaterial({
            color: 0xf2efff,
            roughness: 0.55,
            metalness: 0.05,
            emissive: 0x271033,
            emissiveIntensity: 0.25,
            name: 'cubixlesBlockLetters',
        })
        letterMaterial.userData.prevent = true

        const letterEntries = references
            .map((reference) =>
            {
                const visual = reference.userData.object?.visual?.object3D || reference
                const mesh = visual.isMesh ? visual : visual.getObjectByProperty('isMesh', true)
                if(!mesh || !mesh.geometry)
                    return null
                const worldPosition = new THREE.Vector3()
                mesh.getWorldPosition(worldPosition)
                return { visual, mesh, worldPosition }
            })
            .filter(Boolean)

        if(!letterEntries.length)
            return

        let minX = Infinity
        let maxX = -Infinity
        let minZ = Infinity
        let maxZ = -Infinity
        for(const entry of letterEntries)
        {
            minX = Math.min(minX, entry.worldPosition.x)
            maxX = Math.max(maxX, entry.worldPosition.x)
            minZ = Math.min(minZ, entry.worldPosition.z)
            maxZ = Math.max(maxZ, entry.worldPosition.z)
        }
        const axis = (maxX - minX) >= (maxZ - minZ) ? 'x' : 'z'
        letterEntries.sort((a, b) => a.worldPosition[axis] - b.worldPosition[axis])

        const hideMesh = (mesh) =>
        {
            if(!mesh.isMesh)
                return

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            const nextMaterials = materials.map((material) =>
            {
                if(!material)
                    return material
                const next = material.clone()
                next.transparent = true
                next.opacity = 0
                next.depthWrite = false
                next.colorWrite = false
                next.needsUpdate = true
                return next
            })
            mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0]
        }

        for(let i = 0; i < letterEntries.length; i++)
        {
            const entry = letterEntries[i]
            const character = letters[i] || ''
            const glyph = glyphs[character] || glyphs[character.toLowerCase()]
            const visual = entry.visual

            if(visual.userData.blockLetterGroup)
            {
                const oldGroup = visual.userData.blockLetterGroup
                oldGroup.traverse((child) =>
                {
                    if(child.isMesh || child.isInstancedMesh)
                        child.geometry?.dispose()
                })
                visual.remove(oldGroup)
                visual.userData.blockLetterGroup = null
            }

            visual.traverse((child) =>
            {
                if(child.isMesh)
                    hideMesh(child)
            })

            if(!glyph)
            {
                visual.visible = false
                continue
            }

            visual.visible = true
            visual.updateWorldMatrix(true, true)

            const bounds = new THREE.Box3().setFromObject(visual)
            const size = new THREE.Vector3()
            bounds.getSize(size)
            const centerWorld = bounds.getCenter(new THREE.Vector3())
            const centerLocal = visual.worldToLocal(centerWorld.clone())

            const rows = glyph.length
            const cols = glyph[0].length
            const pixelSize = Math.min(size.x / (cols + 1), size.y / (rows + 1)) * 0.95
            const depth = pixelSize * 0.6

            const cubeGeometry = new THREE.BoxGeometry(pixelSize, pixelSize, depth)
            const count = glyph.reduce((acc, row) => acc + row.split('').filter((c) => c === '1').length, 0)
            const instanced = new THREE.InstancedMesh(cubeGeometry, letterMaterial, Math.max(count, 1))
            instanced.castShadow = true
            instanced.receiveShadow = true
            instanced.frustumCulled = false

            let index = 0
            const matrix = new THREE.Matrix4()
            for(let row = 0; row < rows; row++)
            {
                const line = glyph[row]
                for(let col = 0; col < cols; col++)
                {
                    if(line[col] !== '1')
                        continue

                    const x = (col - (cols - 1) * 0.5) * pixelSize
                    const y = ((rows - 1) * 0.5 - row) * pixelSize
                    const z = depth * 0.45
                    matrix.makeTranslation(x, y, z)
                    instanced.setMatrixAt(index, matrix)
                    index++
                }
            }
            instanced.instanceMatrix.needsUpdate = true

            const letterGroup = new THREE.Group()
            letterGroup.name = 'cubixlesBlockLetter'
            letterGroup.position.copy(centerLocal)
            letterGroup.add(instanced)
            visual.add(letterGroup)
            visual.userData.blockLetterGroup = letterGroup
        }
    }

    setKiosk()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Map',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
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

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
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

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            'Res(e)t',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
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

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}
