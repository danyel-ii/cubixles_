import * as THREE from 'three/webgpu'
import { color, float, mix, normalLocal, positionLocal, step } from 'three/tsl'

export function createCubeSledVehicle()
{
    const createGhostCanvasTexture = () =>
    {
        if(typeof document === 'undefined')
            return null

        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if(!ctx)
            return null

        ctx.clearRect(0, 0, size, size)

        const pixels = [
            '00000111111100000000000000000000',
            '00001111111110000000000000000000',
            '00011111111111000000000000000000',
            '00112222222222110000000000000000',
            '01122222222222211000000000000000',
            '01122222002222211000000000000000',
            '01122222002222211000000000000000',
            '01122222222222211000000000000000',
            '01122222222222211000000000000000',
            '01122222222222211000000000000000',
            '01122222222222211000000000000000',
            '01122222222222211000000000000000',
            '01122222222222211000000000000000',
            '01122222222222211000000000000000',
            '00112222222222110000000000000000',
            '00011110000011100000000000000000'
        ]

        const scale = size / pixels.length
        for(let y = 0; y < pixels.length; y++)
        {
            const row = pixels[y]
            for(let x = 0; x < row.length; x++)
            {
                const value = row[x]
                if(value === '0')
                    continue
                ctx.fillStyle = value === '1' ? '#000000' : '#ffffff'
                ctx.fillRect(x * scale, y * scale, scale, scale)
            }
        }

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = true
        texture.minFilter = THREE.NearestFilter
        texture.magFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        texture.needsUpdate = true
        return texture
    }

    const applyGhostTexture = (material, texture) =>
    {
        if(!material || !texture)
            return
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = true
        texture.minFilter = THREE.NearestFilter
        texture.magFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        texture.needsUpdate = true
        material.map = texture
        material.needsUpdate = true
    }

    const root = new THREE.Group()

    const chassis = new THREE.Group()
    chassis.name = 'chassis'
    root.add(chassis)

    const cubeBaseColor = color('#1ee7ff')
    const cubeGlowColor = color('#2ff3ff')
    const cubeMagenta = color('#ff2eb4')
    const lineThickness = float(0.06)
    const frontFace = step(float(0.9), normalLocal.z)
    const lineBand = step(lineThickness, positionLocal.y.abs()).oneMinus()
    const lineMask = frontFace.mul(lineBand)
    const cubeColorNode = mix(cubeBaseColor, cubeMagenta, lineMask)
    const cubeEmissiveNode = mix(cubeGlowColor, cubeMagenta, lineMask).mul(float(1.6))

    const cubeGlowMat = new THREE.MeshStandardNodeMaterial()
    cubeGlowMat.colorNode = cubeColorNode
    cubeGlowMat.emissiveNode = cubeEmissiveNode
    cubeGlowMat.roughness = 0.25
    cubeGlowMat.metalness = 0.15
    cubeGlowMat.name = 'cubeGlow'
    cubeGlowMat.userData.prevent = true

    const cubeGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8)
    const cube = new THREE.Mesh(cubeGeometry, cubeGlowMat)
    cube.name = 'bodyPainted'
    cube.position.set(0, 1.8, 0)
    cube.userData.preventPaints = true
    chassis.add(cube)

    const cubeEdgeMat = new THREE.LineBasicMaterial({ color: 0x0b0b10, transparent: true, opacity: 0.9 })
    const cubeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeometry), cubeEdgeMat)
    cubeEdges.name = 'bodyEdges'
    cubeEdges.scale.setScalar(1.01)
    cube.add(cubeEdges)

    const skinGeometry = new THREE.BoxGeometry(1.86, 1.86, 1.86)
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.95 })
    skinMaterial.userData.prevent = true
    const skinCube = new THREE.Mesh(skinGeometry, skinMaterial)
    skinCube.name = 'skinCube'
    skinCube.position.copy(cube.position)
    skinCube.visible = false
    skinCube.userData.preventPaints = true
    chassis.add(skinCube)

    const sledMat = new THREE.MeshStandardMaterial({ color: 0x3a2a34, roughness: 0.8, metalness: 0.1, name: 'sledBase' })
    const harnessMat = new THREE.MeshStandardMaterial({ color: 0xd25353, roughness: 0.4, metalness: 0.1, name: 'harness' })
    const sledBase = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 2.2), sledMat)
    sledBase.position.set(0, 0.6, 0)
    chassis.add(sledBase)

    const runnerGeo = new THREE.BoxGeometry(3.6, 0.2, 0.3)
    const runnerLeft = new THREE.Mesh(runnerGeo, sledMat)
    runnerLeft.position.set(0, 0.25, -0.85)
    chassis.add(runnerLeft)
    const runnerRight = new THREE.Mesh(runnerGeo, sledMat)
    runnerRight.position.set(0, 0.25, 0.85)
    chassis.add(runnerRight)

    const frontBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 12), sledMat)
    frontBar.rotation.z = Math.PI / 2
    frontBar.position.set(1.3, 0.8, 0)
    chassis.add(frontBar)

    const ghostMaterial = new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false
    })
    const ghostSprite = new THREE.Sprite(ghostMaterial)
    ghostSprite.name = 'ghostSprite'
    ghostSprite.position.set(2.2, 1.1, 0)
    ghostSprite.scale.set(1.25, 1.25, 1.25)

    const fallbackTexture = createGhostCanvasTexture()
    if(fallbackTexture)
        applyGhostTexture(ghostMaterial, fallbackTexture)

    const ghostLoader = new THREE.TextureLoader()
    ghostLoader.load(
        'vehicle/ghost-sprite.png',
        (texture) =>
        {
            applyGhostTexture(ghostMaterial, texture)
        },
        undefined,
        () => {}
    )

    chassis.add(ghostSprite)

    const blinkerMat = new THREE.MeshStandardMaterial({ color: 0xfff1eb, emissive: 0xff5c7a, emissiveIntensity: 0.8, name: 'blinkers' })
    const blinkerLeft = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), blinkerMat)
    blinkerLeft.name = 'blinkerLeft'
    blinkerLeft.position.set(-1.6, 0.6, -0.7)
    chassis.add(blinkerLeft)

    const blinkerRight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), blinkerMat)
    blinkerRight.name = 'blinkerRight'
    blinkerRight.position.set(-1.6, 0.6, 0.7)
    chassis.add(blinkerRight)

    const backLights = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), blinkerMat)
    backLights.name = 'backLights'
    backLights.position.set(-1.7, 0.5, 0)
    chassis.add(backLights)

    const stopLights = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), blinkerMat)
    stopLights.name = 'stopLights'
    stopLights.position.set(-1.65, 0.42, 0)
    chassis.add(stopLights)

    const antenna = new THREE.Group()
    antenna.name = 'antenna'
    const antennaRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), harnessMat)
    antennaRod.position.set(0, 0.7, 0)
    antenna.add(antennaRod)
    const antennaRef = new THREE.Object3D()
    antennaRef.name = 'antennaHeadReference'
    antennaRef.position.set(0, 1.4, 0)
    antenna.add(antennaRef)
    antenna.position.set(-0.4, 2.2, -0.8)
    chassis.add(antenna)

    const antennaHead = new THREE.Group()
    antennaHead.name = 'antennaHead'
    const headAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 10), harnessMat)
    headAxle.rotation.x = Math.PI / 2
    antennaHead.add(headAxle)
    const headOrb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), blinkerMat)
    headOrb.position.set(0, 0.18, 0)
    antennaHead.add(headOrb)
    root.add(antennaHead)

    const wheelContainer = new THREE.Group()
    wheelContainer.name = 'wheelContainer'
    wheelContainer.visible = false
    const wheelSuspension = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), sledMat)
    wheelSuspension.name = 'wheelSuspension'
    wheelSuspension.position.set(0, 0.3, 0)
    wheelContainer.add(wheelSuspension)
    const wheelCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), sledMat)
    wheelCylinder.name = 'wheelCylinder'
    wheelCylinder.rotation.x = Math.PI / 2
    wheelCylinder.position.set(0, 0, 0)
    wheelContainer.add(wheelCylinder)
    const wheelPainted = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), cubeGlowMat)
    wheelPainted.name = 'wheelPainted'
    wheelPainted.rotation.x = Math.PI / 2
    wheelPainted.position.set(0, 0, 0)
    wheelContainer.add(wheelPainted)
    root.add(wheelContainer)

    return root
}
